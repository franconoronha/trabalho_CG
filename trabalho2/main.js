"use strict";

import { terrainVS, terrainFS } from "./shaders/terrainShaders.js";
import { ballVS, ballFS } from "./shaders/ballShader.js";
import { vs, fs } from "./shaders/objShaders.js";
import { planeVS, planeFS } from "./shaders/planeShader.js";
import { skyboxVS, skyboxFS } from "./shaders/skyboxShader.js";

import objLoader from "./objLoader.js";

const degToRad = (deg) => deg * Math.PI / 180;

const pointSum = (A, B) => [A[0] + B[0], A[1] + B[1], A[2] + B[2]];

const pointMultiplyScalar = (A, s) => [A[0] * s, A[1] * s, A[2] * s];

const subtractVector2 = (a, b) => a.map((v, ndx) => v - b[ndx]);

// (1-t)^(3)A + 3t(1-t)^(2)c1 + 3t^(2)(1-t)c2 + t^(3)B
function bezierCurve(A, B, c1, c2, t, i) {
  let firstTerm = pointMultiplyScalar(A, (1 - t + i) ** 3);
  let secondTerm = pointMultiplyScalar(c1, 3 * ((1 - t + i) ** 2) * (t - i));
  let thirdTerm = pointMultiplyScalar(c2, 3 * (1 - t + i) * ((t - i) ** 2));
  let fourthTerm = pointMultiplyScalar(B, (t - i) ** 3);
  return pointSum(firstTerm, pointSum(secondTerm, pointSum(thirdTerm, fourthTerm)));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = _ => resolve(img);
    img.onerror = reject;
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

async function main() {
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) { return; }

  twgl.setAttributePrefix("a_");
  const birdProgramInfo = twgl.createProgramInfo(gl, [vs, fs]);

  const loader = new objLoader(gl, twgl);
  var penguinModel = await loader.loadObjMtl("penguin", birdProgramInfo);

  penguinModel.bounds.minX = penguinModel.bounds.minX * 10 + 100;
  penguinModel.bounds.maxX = penguinModel.bounds.maxX * 10 + 100;
  penguinModel.bounds.minY = penguinModel.bounds.minY * 10 + 100;
  penguinModel.bounds.maxY = penguinModel.bounds.maxY * 10 + 100;
  penguinModel.bounds.minZ = penguinModel.bounds.minZ * 10;
  penguinModel.bounds.maxZ = penguinModel.bounds.maxZ * 10;

  penguinModel.worldMatrix = m4.translation(100, 100, 0);
  penguinModel.worldMatrix = m4.scale(penguinModel.worldMatrix, 10, 10, 10);
  console.log(penguinModel);

  let allModels = [penguinModel];
  const zNear = 10;
  const zFar = 2000;

  let pointA = [0, 100, 0];
  let pointB = [0, 0, 0];
  let pointC = [3.6632, 10, 35.0648];
  let pointD = [28.481, 10, 26.6826];
  let pointE = [38.0137, 10, 37.037];

  let pointC1 = [0, 100, 0];
  let pointC2 = [-3.7328, 10, 59.3896];
  let pointC3 = [6.868, 10, 48.048];
  let pointC4 = [17.962, 10, 43.364];
  let pointC5 = [-3.486, 10, 30.914];
  let pointC6 = [-13.409, 10, 27.935];
  let pointC7 = [49.426, 10, 26.056];
  let pointC8 = [72.852, 10, 26.174];

  let cameraPosition = [0, 100, 0];
  let cameraTarget = [10, 100, 0];

  let curves = [(t) => bezierCurve(pointA, pointB, pointC1, pointC2, t, 0),
                (t) => bezierCurve(pointB, pointC, pointC3, pointC4, t, 1),
                (t) => bezierCurve(pointC, pointD, pointC5, pointC6, t, 2),
                (t) => bezierCurve(pointD, pointE, pointC7, pointC8, t, 3)
  ];

  let then = 0;
  let animationTimeSum = 0;
  const numCurves = curves.length;

  let controls = new function() {
    this.t = 0;
    this.animationDuration = 10;
    this.lightx = -10;
    this.lighty = 3;
    this.lightz = -10;
    this.cameraX = 0;
    this.cameraY = 100;
    this.cameraZ = 0;
    this.kc = 0.25;
    this.kl = 0.0001;
    this.kq = 0.00005;
  }

  let gui = new dat.GUI();
  gui.add(controls, 't', 0, numCurves).listen();
  
  let controlAnimationDuration = gui.add(controls, 'animationDuration', 1, 100);
  controlAnimationDuration.onChange(function(value) {
    playing = false;
    animationTimeSum = 0;
    controls.t = 0;
  });

  controlAnimationDuration.domElement.id = "animationDuration";
    let playing = false;
    let buttons = { play:function(){ playing=true },
    pause: function() { playing=false; },
    reset: function() { playing=false; controls.t = 0; animationTimeSum = 0;},
    lightconfig: function() { controls.lightx = 2, controls.lighty = -8, controls.lightz = -8;}
  };

  let animationFolder = gui.addFolder("Animation");
  animationFolder.add(buttons,'play');
  animationFolder.add(buttons,'pause');
  animationFolder.add(buttons,'reset');

  let lightFolder = gui.addFolder("Light");
  lightFolder.add(buttons, 'lightconfig');
  lightFolder.add(controls, 'lightx', -10, 10);
  lightFolder.add(controls, 'lighty', -10, 10);
  lightFolder.add(controls, 'lightz', -10, 10);

  let cameraFolder = gui.addFolder("Camera");
  cameraFolder.add(controls, 'cameraX', -500, 500);
  cameraFolder.add(controls, 'cameraY', 0, 500);
  cameraFolder.add(controls, 'cameraZ', -500, 500);

  let attenuationFolder = gui.addFolder("Attenuation");
  attenuationFolder.add(controls, 'kc', -2, 2);
  attenuationFolder.add(controls, 'kl', 0, 0.1);
  attenuationFolder.add(controls, 'kq', 0, 0.01);

  const terrainProgramInfo = twgl.createProgramInfo(gl, [terrainVS, terrainFS]);
  const ballProgramInfo = twgl.createProgramInfo(gl, [ballVS, ballFS]);
  const planeProgramInfo = twgl.createProgramInfo(gl, [planeVS, planeFS]);
  const skyboxProgramInfo = twgl.createProgramInfo(gl, [skyboxVS, skyboxFS]);

  const radius = 5;
  let ballBufferInfo = twgl.primitives.createSphereBufferInfo(gl, radius, 64, 64);

  function createBallObj(worldMatrix, direction) {
    if(!worldMatrix) {
      worldMatrix = [0, 0, 0];
      direction = [0, 0, 0]
    }
    return {
      worldMatrix: m4.translation(...worldMatrix),
      direction: m4.normalize(subtractVector2(direction, worldMatrix))
    }
  }

  let balls = [
    createBallObj(null, null),
    createBallObj(null, null),
    createBallObj(null, null),
    createBallObj(null, null),
    createBallObj(null, null),
  ];

  const maxBalls = 5;
  let activeBalls = 0;

  function addBall() {
    if (activeBalls < maxBalls) {
      balls[activeBalls] = createBallObj(cameraPosition, cameraTarget);
      activeBalls++;
    } else {
      balls.shift();
      balls.push(createBallObj(cameraPosition, cameraTarget));
    }
  }

  document.addEventListener('keyup', event => {
    if (event.code === 'Space') {
      addBall();
    }
  });

  function drawBalls(sharedUniforms) {
    gl.useProgram(ballProgramInfo.program);
    twgl.setBuffersAndAttributes(gl, ballProgramInfo, ballBufferInfo);
    twgl.setUniforms(ballProgramInfo, sharedUniforms);
    for(let i = 0; i < activeBalls; i++) {
      twgl.setUniforms(ballProgramInfo, {
        u_world : balls[i].worldMatrix
      });
      twgl.drawBufferInfo(gl, ballBufferInfo);
    }
  }

  const terrainBufferInfo = twgl.primitives.createPlaneBufferInfo(
    gl,
    960,  // width
    960,  // height
    240,  // quads across
    240,  // quads down
  );
  
  const planeBufferInfo = twgl.primitives.createPlaneBufferInfo(gl, 5000, 5000, 1, 1);
  const quadBufferInfo = twgl.primitives.createXYQuadBufferInfo(gl); 
  const quadVAO = twgl.createVAOFromBufferInfo(gl, skyboxProgramInfo, quadBufferInfo);

  const heightMapTexture = twgl.createTexture(gl, {
    src: './models/ridge-height.png',
  });

  const groundTexture = twgl.createTexture(gl, {
    src: './models/ridge.png',
  });

  const normalMapTexture = twgl.createTexture(gl, {
    src: './models/normal2.png',
  });

  const skyboxTexture = twgl.createTexture(gl, {
    target: gl.TEXTURE_CUBE_MAP,
    src: [
      "./models/Box_Front.bmp",
      "./models/Box_Back.bmp",
      "./models/Box_Top.bmp",
      "./models/Box_Bottom.bmp",
      "./models/Box_Left.bmp",
      "./models/Box_Right.bmp",
    ],
    min: gl.LINEAR_MIPMAP_LINEAR
  });

  
  // get image data
  const img = await loadImage("./models/ridge-height.png");
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.canvas.width = img.width;
  ctx.canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, img.width, img.height);
  const v3 = twgl.v3;
  // generate normals from height data
  const displacementScale = 200;
  const data = new Uint8Array(imgData.data.length);
  for (let z = 0; z < imgData.height; ++z) {
    for (let x = 0; x < imgData.width; ++x) {
      const off = (z * img.width + x) * 4;
      const h0 = imgData.data[off];
      const h1 = imgData.data[off + 4] || 0;  // being lazy at edge
      const h2 = imgData.data[off + imgData.width * 4] || 0; // being lazy at edge
      const p0 = [x    , h0 * displacementScale / 255, z    ];
      const p1 = [x + 1, h1 * displacementScale / 255, z    ];
      const p2 = [x    , h2 * displacementScale / 255, z + 1];
      const v0 = v3.normalize(v3.subtract(p1, p0));
      const v1 = v3.normalize(v3.subtract(p2, p0));
      const normal = v3.normalize(v3.cross(v0, v1));
      data[off + 0] = (normal[0] * 0.5 + 0.5) * 255;
      data[off + 1] = (normal[1] * 0.5 + 0.5) * 255;
      data[off + 2] = (normal[2] * 0.5 + 0.5) * 255;
      data[off + 3] = h0;
    }
  }  

  const displacementNormalTexture = twgl.createTexture(gl, {
    src: data,
  });

  let terrain_worldMatrix = m4.identity();

  function drawTerrain(sharedUniforms) {
    gl.useProgram(terrainProgramInfo.program);
    twgl.setBuffersAndAttributes(gl, terrainProgramInfo, terrainBufferInfo);
    twgl.setUniforms(terrainProgramInfo, sharedUniforms);
    twgl.setUniformsAndBindTextures(terrainProgramInfo, {
      u_world : terrain_worldMatrix,
      displacementMap: heightMapTexture,
      groundTexture : groundTexture,
      normalMap: normalMapTexture,
      displacementNormalTexture: displacementNormalTexture
    });
    twgl.drawBufferInfo(gl, terrainBufferInfo);

    gl.useProgram(planeProgramInfo.program);
    twgl.setBuffersAndAttributes(gl, planeProgramInfo, planeBufferInfo);
    twgl.setUniforms(planeProgramInfo, sharedUniforms);
    twgl.setUniformsAndBindTextures(planeProgramInfo, {
      u_world : terrain_worldMatrix,
      groundTexture : groundTexture
    });
    twgl.drawBufferInfo(gl, planeBufferInfo);
  }

  function render(time) {
    time *= 0.001;  // convert to seconds
    let deltaTime = time - then;

  	if (playing) { 
      animationTimeSum += deltaTime;
      if (animationTimeSum > controls.animationDuration) {
        animationTimeSum = 0;
      }
      controls.t = (animationTimeSum / controls.animationDuration) * numCurves;
  	  if (controls.t > numCurves) controls.t = numCurves;
    }

    then = time;

    let curveNum = Math.floor(controls.t);
    if(curveNum >= numCurves) curveNum = numCurves - 1;

    //let cameraPosition = [0, 100, 100];
    cameraPosition = [controls.cameraX, controls.cameraY, controls.cameraZ];
    //cameraTarget = [-299, 100, 300];
    //let cameraTarget = [ballWorldMatrix[12], ballWorldMatrix[13], ballWorldMatrix[14]];
    //let cameraTarget = balls[0].slice(12, 15);

    for(let i = 0; i < activeBalls; i++) {
      let speed = 300;
      let movement = pointMultiplyScalar(balls[i].direction, speed * deltaTime);
      balls[i].worldMatrix = m4.translate(balls[i].worldMatrix, ...movement);

      let [ballX, ballY, ballZ] = balls[i].worldMatrix.slice(12, 15);
      for(let m in allModels) {
        let model = allModels[m];
        const x = Math.max(model.bounds.minX, Math.min(ballX, model.bounds.maxX));
        const y = Math.max(model.bounds.minY, Math.min(ballY, model.bounds.maxY));
        const z = Math.max(model.bounds.minZ, Math.min(ballZ, model.bounds.maxZ));
        const distance = Math.sqrt(
          (x - ballX) * (x - ballX) +
          (y - ballY) * (y - ballY) +
          (z - ballZ) * (z - ballZ),
        );
        if (distance < radius) {
          allModels.splice(m, 1);
        }
      }
    }
    /* let cameraPosition = curves[curveNum](controls.t);
    let cameraTarget = curves[curveNum](controls.t + 0.01); */
    
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.clearColor(0.8, 0.8, 0.8, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fieldOfViewRadians = degToRad(60);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

    const up = [0, 1, 0];
    // Compute the camera's matrix using look at.
    const camera = m4.lookAt(cameraPosition, cameraTarget, up);

    // Make a view matrix from the camera matrix.
    const view = m4.inverse(camera);

    let u_lightPositionArray = [];
    for(let ball of balls) {
      u_lightPositionArray.push(...ball.worldMatrix.slice(12, 15));
    }

    const sharedUniforms = {
      u_lightDirection: m4.normalize([controls.lightx, controls.lighty, controls.lightz]),
      u_view: view,
      u_projection: projection,
      u_viewWorldPosition: cameraPosition,
      u_lightPositionArray,
      u_activeBalls: activeBalls,
      u_kc: controls.kc,
      u_kl: controls.kl,
      u_kq: controls.kq
    };

    drawBalls(sharedUniforms);
    drawTerrain(sharedUniforms);

    gl.useProgram(birdProgramInfo.program);
    twgl.setUniforms(birdProgramInfo, sharedUniforms);
    
    allModels.forEach(model => {
      for (const {bufferInfo, vao, material} of model) {
        twgl.setBuffersAndAttributes(gl, birdProgramInfo, bufferInfo);
        let u_world = model.worldMatrix;
        // set the attributes for this part.
        gl.bindVertexArray(vao);
        // calls gl.uniform
        twgl.setUniforms(birdProgramInfo, {
          u_world,
        }, material);
        // calls gl.drawArrays or gl.drawElements
        twgl.drawBufferInfo(gl, bufferInfo);
      }
    });
    //gl.depthFunc(gl.LEQUAL);
    let viewDirection = m4.copy(view);
    viewDirection[12] = 0;
    viewDirection[13] = 0;
    viewDirection[14] = 0;

    gl.depthFunc(gl.LEQUAL);
    gl.useProgram(skyboxProgramInfo.program);
    twgl.setBuffersAndAttributes(gl, skyboxProgramInfo, quadBufferInfo);
    twgl.setUniformsAndBindTextures(skyboxProgramInfo, {
      u_viewDirectionProjectionInverse: m4.inverse(m4.multiply(projection, viewDirection)),
      u_skybox: skyboxTexture,
    });
    twgl.drawBufferInfo(gl, quadBufferInfo);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();

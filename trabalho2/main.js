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

const v3 = twgl.v3;

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

let randomZ = () => Math.random() * (400 - (-400)) + (-400);

async function main() {
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) { return; }

  twgl.setAttributePrefix("a_");
  const shipProgramInfo = twgl.createProgramInfo(gl, [vs, fs]);

  const loader = new objLoader(gl, twgl);
  let shipModel = await loader.loadObjMtl("SpaceShip", shipProgramInfo);
  let baseBounds = shipModel.bounds;
  const sHeight = 125;
  let allModels = [m4.translation(100, sHeight, randomZ()),
                   m4.translation(150, sHeight, randomZ()),
                   m4.translation(200, sHeight, randomZ()),
                   m4.translation(250, sHeight, randomZ()),
                   m4.translation(300, sHeight, randomZ()),
                   m4.translation(50, sHeight, randomZ()),
                   m4.translation(0, sHeight, randomZ()),
                   m4.translation(-50, sHeight, randomZ()),
                   m4.translation(-100, sHeight, randomZ()),
                   m4.translation(-150, sHeight, randomZ()),
                   m4.translation(-200, sHeight, randomZ()),
                   m4.translation(-250, sHeight, randomZ()),
                   m4.translation(-300, sHeight, randomZ()),
  ];

  /* let pointA = [-328.711, sHeight, 359.422]
  let pointB = [345.363, sHeight, 289.319]
  let pointC = [357.945, sHeight, -104.34]
  let pointD = [23.605, sHeight, -287.688]
  let pointE = [-328.711, sHeight, 359.422]

  let pointC1 = [144.039, sHeight, 460.084]
  let pointC2 = [406.479, sHeight, 373.802]
  let pointC3 = [314.805, sHeight, 247.077]
  let pointC4 = [218.637, sHeight, 226.405]
  let pointC5 = [427.6, sHeight, -269.713]
  let pointC6 = [521.296, sHeight, -429.918]
  let pointC7 = [-225.24, sHeight, -216.573]
  let pointC8 = [-497.51, sHeight, -105.407] */

  let pointA = [-329.055, sHeight, 359.063];
  let pointB = [162.082, sHeight, 108.648];
  let pointC = [158.85, sHeight, -57.757];
  let pointD = [-33.403, sHeight, -216.084];
  let pointE = [-329.055, sHeight, 359.063];

  let pointC1 = [0, sHeight, 30];
  let pointC2 = [242.861, sHeight, 140.959];
  let pointC3 = [121.692, sHeight, 92.492];
  let pointC4 = [20.587, sHeight, 116.096];
  let pointC5 = [227.982, sHeight, -144.684];
  let pointC6 = [322.39, sHeight, -237.511];
  let pointC7 = [-211.3, sHeight, -205.37];
  let pointC8 = [-412.8, sHeight, -175.37];


  let cameraPosition = v3.copy(pointA);
  let cameraTarget = v3.copy(pointB);

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
    this.animationDuration = 30;
    this.lightx = 2;
    this.lighty = 3;
    this.lightz = 1;
    this.cameraX = pointA[0];
    this.cameraY = pointA[1];
    this.cameraZ = pointA[2];
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

  const planeBufferInfo = twgl.primitives.createPlaneBufferInfo(gl, 5000, 5000, 1, 1);
  const quadBufferInfo = twgl.primitives.createXYQuadBufferInfo(gl); 
  
  const heightMapTexture = twgl.createTexture(gl, {
    src: './models/ridge-height.png'
  });

  const groundTexture = twgl.createTexture(gl, {
    src: './models/ridge.png'
  });

  const skyboxTexture = twgl.createTexture(gl, {
    target: gl.TEXTURE_CUBE_MAP,
    src: [
      "./models/Textures/Skybox/Box_Right.bmp",
      "./models/Textures/Skybox/Box_Left.bmp",
      "./models/Textures/Skybox/Box_Top.bmp",
      "./models/Textures/Skybox/Box_Bottom.bmp",
      "./models/Textures/Skybox/Box_Front.bmp",
      "./models/Textures/Skybox/Box_Back.bmp",
    ],
    min: gl.LINEAR_MIPMAP_LINEAR
  });
  
  // PRECOMPUTE NORMALS
  const img = await loadImage("./models/ridge-height.png");
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  ctx.canvas.width = img.width;
  ctx.canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, img.width, img.height);
  const displacementScale = 200;

  const terrainVertices = twgl.primitives.createPlaneVertices(960, 960, 240, 240);
  let triangles = [];
  let normals = [];
  let vertices = [];
  let texcoords = [];
  let indicesNormals = [];

  for(let i = 0; i < terrainVertices.texcoord.length; i += 2) {
    texcoords.push([terrainVertices.texcoord[i], terrainVertices.texcoord[i + 1]]);
  }
  for(let i = 0; i < terrainVertices.indices.length; i += 3) {
    triangles.push([terrainVertices.indices[i], terrainVertices.indices[i + 1], terrainVertices.indices[i + 2]]);
  }
  for(let i = 0; i < terrainVertices.position.length; i += 3) {
    let vertexPosition = [terrainVertices.position[i], terrainVertices.position[i + 1], terrainVertices.position[i + 2]];
    vertices.push(vertexPosition);
  }

  for(let i = 0; i < vertices.length; i++) {
    let x = Math.floor(vertices[i][0] + imgData.width / 2);
    let z = Math.floor(vertices[i][2] + imgData.height / 2);
    let imageData = ctx.getImageData(x, z, 1, 1).data;
    let red = imageData[0]; 
    let height = red * displacementScale / 255;
    vertices[i][1] = height;
    indicesNormals.push({
      normal: v3.create(0, 0, 0),
      count: 0
    });
  }

  for(let i = 0; i < triangles.length; i++) {
    let v0 = vertices[triangles[i][0]];
    let v1 = vertices[triangles[i][1]];
    let v2 = vertices[triangles[i][2]];
    let v01 = v3.subtract(v1, v0);
    let v02 = v3.subtract(v2, v0);
    let normal = v3.normalize(v3.cross(v01, v02));
    normals.push(normal);
  }

  for(let i = 0; i < triangles.length; i++) {
    indicesNormals[triangles[i][0]].normal = v3.add(normals[i], indicesNormals[triangles[i][0]].normal);
    indicesNormals[triangles[i][1]].normal = v3.add(normals[i], indicesNormals[triangles[i][1]].normal);
    indicesNormals[triangles[i][2]].normal = v3.add(normals[i], indicesNormals[triangles[i][2]].normal);

    indicesNormals[triangles[i][0]].count++;
    indicesNormals[triangles[i][1]].count++;
    indicesNormals[triangles[i][2]].count++;
  }

  let averagedNormals = [];
  for(let i = 0; i < indicesNormals.length; i++) {
    let average;
    if(indicesNormals[i].count == 0) {
      average = [0, 1, 0];
    } else {
      average = v3.divScalar(indicesNormals[i].normal, indicesNormals[i].count);
    }
    averagedNormals.push(...v3.normalize(average));
  }
  // END PRECOMPUTE NORMALS 

  let terrainBufferInfo = twgl.createBufferInfoFromArrays(gl, {
    position: terrainVertices.position,
    normal: averagedNormals,
    texcoord: terrainVertices.texcoord,
    indices: terrainVertices.indices
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
  
  const zNear = 10;
  const zFar = 2000;

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

    if(playing) {
      cameraPosition = curves[curveNum](controls.t);
      cameraTarget = curves[curveNum](controls.t + 0.01);
    } else {
      cameraPosition = [controls.cameraX, controls.cameraY, controls.cameraZ];
    }


    for(let m in allModels) {
      allModels[m] = m4.translate(allModels[m], 0, 0, 15 * deltaTime);	
      if(allModels[m][14] > 500) {
        allModels[m][14] = -500;
      }
    }

    for(let i = 0; i < activeBalls; i++) {
      let speed = 300;
      let movement = pointMultiplyScalar(balls[i].direction, speed * deltaTime);
      balls[i].worldMatrix = m4.translate(balls[i].worldMatrix, ...movement);

      let [ballX, ballY, ballZ] = balls[i].worldMatrix.slice(12, 15);
      for(let m in allModels) {
        let [modelX, modelY, modelZ] = allModels[m].slice(12, 15);
        let modelBound = {
          minX: baseBounds.minX + modelX,
          minY: baseBounds.minY + modelY,
          minZ: baseBounds.minZ + modelZ,
          maxX: baseBounds.maxX + modelX,
          maxY: baseBounds.maxY + modelY,
          maxZ: baseBounds.maxZ + modelZ,
        }; 
        const x = Math.max(modelBound.minX, Math.min(ballX, modelBound.maxX));
        const y = Math.max(modelBound.minY, Math.min(ballY, modelBound.maxY));
        const z = Math.max(modelBound.minZ, Math.min(ballZ, modelBound.maxZ));
        const distance = Math.sqrt(
          (x - ballX) * (x - ballX) +
          (y - ballY) * (y - ballY) +
          (z - ballZ) * (z - ballZ),
        );
        if (distance < radius) {
          allModels.splice(m, 1);
          balls.splice(i, 1);
          balls.push(createBallObj(null, null));
        }
      }
    }
    
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
    const camera = m4.lookAt(cameraPosition, cameraTarget, up);
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

    gl.useProgram(shipProgramInfo.program);
    twgl.setUniforms(shipProgramInfo, sharedUniforms);

    allModels.forEach(model => {
      for (const {bufferInfo, vao, material} of shipModel) {
        twgl.setBuffersAndAttributes(gl, shipProgramInfo, bufferInfo);
        twgl.setUniforms(shipProgramInfo, {
          u_world: model,
        }, material);
        twgl.drawBufferInfo(gl, bufferInfo);
      }
    });
    
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

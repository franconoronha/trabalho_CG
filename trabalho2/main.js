"use strict";

import { terrainVS, terrainFS } from "./terrainShaders.js";
import { vs, fs } from "./objShaders.js"

async function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) { return; }

  // Tell the twgl to match position with a_position etc..
  twgl.setAttributePrefix("a_");
  // compiles and links the shaders, looks up attribute and uniform locations
  const meshProgramInfo = twgl.createProgramInfo(gl, [vs, fs]);

  /* var [casaObj, casaMaterials] = await loadObjMtl("casa"); */

  var allModels = [];

  const zNear = 10;
  const zFar = 1000;

  function degToRad(deg) {
    return deg * Math.PI / 180;
  }

	function pointSum(A, B) {
		return [A[0] + B[0], A[1] + B[1], A[2] + B[2]];
	}

	function pointMultiplyScalar(A, s) {
		return [A[0] * s, A[1] * s, A[2] * s];
	}

  var pointA = [0, 100, 0];
  var pointB = [0, 0, 0];
  var pointC = [3.6632, 10, 35.0648];
  var pointD = [28.481, 10, 26.6826];
  var pointE = [38.0137, 10, 37.037];

  var pointC1 = [0, 100, 0];
  var pointC2 = [-3.7328, 10, 59.3896];
  var pointC3 = [6.868, 10, 48.048];
  var pointC4 = [17.962, 10, 43.364];
  var pointC5 = [-3.486, 10, 30.914];
  var pointC6 = [-13.409, 10, 27.935];
  var pointC7 = [49.426, 10, 26.056];
  var pointC8 = [72.852, 10, 26.174];

  // (1-t)^(3)A + 3t(1-t)^(2)c1 + 3t^(2)(1-t)c2 + t^(3)B
	function bezierCurve(A, B, c1, c2, t, i) {
		var firstTerm = pointMultiplyScalar(A, (1 - t + i) ** 3);
		var secondTerm = pointMultiplyScalar(c1, 3 * ((1 - t + i) ** 2) * (t - i));
		var thirdTerm = pointMultiplyScalar(c2, 3 * (1 - t + i) * ((t - i) ** 2));
		var fourthTerm = pointMultiplyScalar(B, (t - i) ** 3);
		return pointSum(firstTerm, pointSum(secondTerm, pointSum(thirdTerm, fourthTerm)));
	}

  let curves = [(t) => bezierCurve(pointA, pointB, pointC1, pointC2, t, 0),
                (t) => bezierCurve(pointB, pointC, pointC3, pointC4, t, 1),
                (t) => bezierCurve(pointC, pointD, pointC5, pointC6, t, 2),
                (t) => bezierCurve(pointD, pointE, pointC7, pointC8, t, 3)];

  let then = 0;
  let animationTimeSum = 0;
  const numCurves = curves.length;

  let controls = new function() {
    this.t = 0;
    this.animationDuration = 10;
    this.lightx = 5;
    this.lighty = 1;
    this.lightz = 0.2;
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
  gui.add(buttons,'play');
  gui.add(buttons,'pause');
  gui.add(buttons,'reset');
  gui.add(buttons, 'lightconfig');
  gui.add(controls, 'lightx', -10, 10);
  gui.add(controls, 'lighty', -10, 10);
  gui.add(controls, 'lightz', -10, 10);
  const terrainProgramInfo = twgl.createProgramInfo(gl, [terrainVS, terrainFS]);

  const terrainBufferInfo = twgl.primitives.createPlaneBufferInfo(
    gl,
    96 * 2,  // width
    64 * 2,  // height
    96 * 2,  // quads across
    64 * 2,  // quads down
);

  const heightMapTexture = twgl.createTexture(gl, {
    src: './models/heightmap_3.png',
    minMag: gl.NEAREST,
    wrap: gl.CLAMP_TO_EDGE,
  });

  const normalMapTexture = twgl.createTexture(gl, {
    src: './models/normalMap_3.png',
    minMag: gl.NEAREST,
    wrap: gl.CLAMP_TO_EDGE,
  });

  let terrain_worldMatrix = m4.identity();

  console.log(terrainBufferInfo);
  function drawTerrain(sharedUniforms) {
    gl.useProgram(terrainProgramInfo.program);
    twgl.setBuffersAndAttributes(gl, terrainProgramInfo, terrainBufferInfo);
    twgl.setUniformsAndBindTextures(terrainProgramInfo, sharedUniforms);
    twgl.setUniforms(terrainProgramInfo, {
      u_world : terrain_worldMatrix,
      displacementMap: heightMapTexture,
      normalMap : normalMapTexture
    });
    twgl.drawBufferInfo(gl, terrainBufferInfo);
  }

  function render(time) {
    time *= 0.001;  // convert to seconds
    var deltaTime = time - then;

  	if (playing) { 
      animationTimeSum += deltaTime;
      if (animationTimeSum > controls.animationDuration) {
        animationTimeSum = 0;
      }
      controls.t = (animationTimeSum / controls.animationDuration) * numCurves;
  	  if (controls.t > numCurves) controls.t = numCurves;
    }

    then = time;

    var curveNum = Math.floor(controls.t);
    if(curveNum >= numCurves) curveNum = numCurves - 1;

    let cameraPosition = [0, 100, 100];
    let cameraTarget = [0, 0, 0];
    /* var cameraPosition = curves[curveNum](controls.t);
    var cameraTarget = curves[curveNum](controls.t + 0.01); */
    
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fieldOfViewRadians = degToRad(60);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

    const up = [0, 1, 0];
    // Compute the camera's matrix using look at.
    const camera = m4.lookAt(cameraPosition, cameraTarget, up);

    // Make a view matrix from the camera matrix.
    const view = m4.inverse(camera);

    const sharedUniforms = {
      u_lightDirection: m4.normalize([controls.lightx, controls.lighty, controls.lightz]),
      u_view: view,
      u_projection: projection,
      u_viewWorldPosition: cameraPosition,
    };

    drawTerrain(sharedUniforms);
    
    gl.useProgram(meshProgramInfo.program);

    // calls gl.uniform
    twgl.setUniforms(meshProgramInfo, sharedUniforms);
    /* twgl.setUniforms(meshProgramInfo2, sharedUniforms); */
    allModels.forEach(model => {
      for (const {bufferInfo, vao, material} of model) {
        let u_world = model.worldMatrix;
        // set the attributes for this part.
        gl.bindVertexArray(vao);
        // calls gl.uniform
        twgl.setUniforms(meshProgramInfo, {
          u_world,
        }, material);
        // calls gl.drawArrays or gl.drawElements
        twgl.drawBufferInfo(gl, bufferInfo);
      }
    });
    

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();

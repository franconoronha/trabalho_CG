"use strict";

var vs = `#version 300 es

in vec4 a_position;
in vec4 a_color;

uniform mat4 u_matrix;

out vec4 v_color;

void main() {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * a_position;

  // Pass the color to the fragment shader.
  v_color = a_color;
}
`;

var fs = `#version 300 es
precision highp float;

// Passed in from the vertex shader.
in vec4 v_color;

uniform vec4 u_colorMult;
uniform vec4 u_colorOffset;

out vec4 outColor;

void main() {
   outColor = v_color * u_colorMult + u_colorOffset;
}
`;

var Node = function() {
  this.children = [];
  this.localMatrix = m4.identity();
  this.worldMatrix = m4.identity();
};

Node.prototype.setParent = function(parent) {
  // remove us from our parent
  if (this.parent) {
    var ndx = this.parent.children.indexOf(this);
    if (ndx >= 0) {
      this.parent.children.splice(ndx, 1);
    }
  }

  // Add us to our new parent
  if (parent) {
    parent.children.push(this);
  }
  this.parent = parent;
};

Node.prototype.updateWorldMatrix = function(matrix) {
  if (matrix) {
    // a matrix was passed in so do the math
    m4.multiply(matrix, this.localMatrix, this.worldMatrix);
  } else {
    // no matrix was passed in so just copy.
    m4.copy(this.localMatrix, this.worldMatrix);
  }

  // now process all the children
  var worldMatrix = this.worldMatrix;
  this.children.forEach(function(child) {
    child.updateWorldMatrix(worldMatrix);
  });
};



function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  var canvas = document.querySelector("#canvas");
  var gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }

  // Tell the twgl to match position with a_position, n
  // normal with a_normal etc..
  twgl.setAttributePrefix("a_");

  var sphereBufferInfo = flattenedPrimitives.createSphereBufferInfo(gl, 10, 48, 24); 
	var sphereBufferInfo2 = flattenedPrimitives.createSphereBufferInfo(gl, 5, 24, 12); 
	
  // setup GLSL program
  var programInfo = twgl.createProgramInfo(gl, [vs, fs]);
  var sphereVAO = twgl.createVAOFromBufferInfo(gl, programInfo, sphereBufferInfo);
  var sphereVAO2 = twgl.createVAOFromBufferInfo(gl, programInfo, sphereBufferInfo2);

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  var fieldOfViewRadians = degToRad(60);

  var objectsToDraw = [];
  var objects = [];

  // Let's make all the nodes
  var mainNode = new Node();

  var sphereNode = new Node();
  sphereNode.localMatrix = m4.translation(0, 0, 0);
  sphereNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.8, 0.1, 0.1, 1], 
      u_colorMult:   [1, 0.3, 0.3, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };
  
  var sphereNode2 = new Node();
  sphereNode2.localMatrix = m4.translation(25, 0, 0);
  sphereNode2.drawInfo = {
    uniforms: {
      u_colorOffset: [0.2, 0.3, 1, 1], 
      u_colorMult:   [0.3, 0.1, 0.9, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo2,
    vertexArray: sphereVAO2,
  };
  

  // connect the celetial objects
  sphereNode.setParent(mainNode);
  sphereNode2.setParent(sphereNode);
	
  var objects = [
    sphereNode,
    sphereNode2
  ];

  var objectsToDraw = [
    sphereNode.drawInfo,
    sphereNode2.drawInfo
  ];

	
	var pointA = [50, 50, 0];
	var pointB = [100, 100, 0];	
	var pointC1 = [100, 0, 50];
	var pointC2 = [50, 0, 100];
	var cameraMovementSpeed = 1;

	//(1-t)^(3)A + 3t(1-t)^(2)c1 + 3t^(2)(1-t)c2+ t^(3)B

	function pointSum(A, B) {
		return [A[0] + B[0], A[1] + B[1], A[2] + B[2]];
	}
	
	function pointMultiplyScalar(A, s) {
		return [A[0] * s, A[1] * s, A[2] * s];
	}
	
	function bezierCurve(A, B, c1, c2, t) {
		var firstTerm = pointMultiplyScalar(A, (1 - t) ** 3);
		var secondTerm = pointMultiplyScalar(c1, 3 * t * (1 - t) ** 2);
		var thirdTerm = pointMultiplyScalar(c2, (3 * t ** 2) * (1-t));
		var fourthTerm = pointMultiplyScalar(B, t ** 3);
		return pointSum(firstTerm, pointSum(secondTerm, pointSum(thirdTerm, fourthTerm)));
	}
	
  requestAnimationFrame(drawScene);
	var then = 0;
	var timeSum = 0;
	var animationDuration = 4;
	
  // Draw the scene.
  function drawScene(time) {
    time *= 0.001;

	  // Subtract the previous time from the current time
  	var deltaTime = time - then;
  	timeSum += deltaTime;
  	if (timeSum > animationDuration) {
  		timeSum = 0;
  	}
  	var t = timeSum / animationDuration;
  	if (t > animationDuration) t = animationDuration;
  	var cameraPosition = bezierCurve(pointA, pointB, pointC1, pointC2, t);
  	sphereNode.localMatrix = m4.multiply(m4.yRotation(0.01), sphereNode.localMatrix);
  	
  	// Remember the current time for the next frame.
  	then = time;
  	
    twgl.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // Clear the canvas AND the depth buffer.
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Compute the projection matrix
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var projectionMatrix =
        m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

    // Compute the camera's matrix using look at.
    // var cameraPosition = [50, 0, 50];
    var target = [0, 0, 0];
    var up = [0, 1, 0];
    var cameraMatrix = m4.lookAt(cameraPosition, target, up);

    // Make a view matrix from the camera matrix.
    var viewMatrix = m4.inverse(cameraMatrix);

    var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    // Update all world matrices in the scene graph
    mainNode.updateWorldMatrix();

    // Compute all the matrices for rendering
    objects.forEach(function(object) {
        object.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, object.worldMatrix);
    });

    // ------ Draw the objects --------

    twgl.drawObjectList(gl, objectsToDraw);

    requestAnimationFrame(drawScene);
  }
}

main();

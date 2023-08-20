"use strict";

// This is not a full .obj parser.
// see http://paulbourke.net/dataformats/obj/

function parseOBJ(text) {
  // because indices are base 1 let's just fill in the 0th data
  const objPositions = [[0, 0, 0]];
  const objTexcoords = [[0, 0]];
  const objNormals = [[0, 0, 0]];
  const objColors = [[0, 0, 0]];

  // same order as `f` indices
  const objVertexData = [
    objPositions,
    objTexcoords,
    objNormals,
    objColors,
  ];

  // same order as `f` indices
  let webglVertexData = [
    [],   // positions
    [],   // texcoords
    [],   // normals
    [],   // colors
  ];

  const materialLibs = [];
  const geometries = [];
  let geometry;
  let groups = ['default'];
  let material = 'default';
  let object = 'default';

  const noop = () => {};

  function newGeometry() {
    // If there is an existing geometry and it's
    // not empty then start a new one.
    if (geometry && geometry.data.position.length) {
      geometry = undefined;
    }
  }

  function setGeometry() {
    if (!geometry) {
      const position = [];
      const texcoord = [];
      const normal = [];
      const color = [];
      webglVertexData = [
        position,
        texcoord,
        normal,
        color,
      ];
      geometry = {
        object,
        groups,
        material,
        data: {
          position,
          texcoord,
          normal,
          color,
        },
      };
      geometries.push(geometry);
    }
  }

  function addVertex(vert) {
    const ptn = vert.split('/');
    ptn.forEach((objIndexStr, i) => {
      if (!objIndexStr) {
        return;
      }
      const objIndex = parseInt(objIndexStr);
      const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
      webglVertexData[i].push(...objVertexData[i][index]);
      // if this is the position index (index 0) and we parsed
      // vertex colors then copy the vertex colors to the webgl vertex color data
      if (i === 0 && objColors.length > 1) {
        geometry.data.color.push(...objColors[index]);
      }
    });
  }

  const keywords = {
    v(parts) {
      // if there are more than 3 values here they are vertex colors
      if (parts.length > 3) {
        objPositions.push(parts.slice(0, 3).map(parseFloat));
        objColors.push(parts.slice(3).map(parseFloat));
      } else {
        objPositions.push(parts.map(parseFloat));
      }
    },
    vn(parts) {
      objNormals.push(parts.map(parseFloat));
    },
    vt(parts) {
      // should check for missing v and extra w?
      objTexcoords.push(parts.map(parseFloat));
    },
    f(parts) {
      setGeometry();
      const numTriangles = parts.length - 2;
      for (let tri = 0; tri < numTriangles; ++tri) {
        addVertex(parts[0]);
        addVertex(parts[tri + 1]);
        addVertex(parts[tri + 2]);
      }
    },
    s: noop,    // smoothing group
    mtllib(parts) {
      // the spec says there can be multiple file here
      // but I found one with a space in the filename
      materialLibs.push(parts.join(' '));
    },
    usemtl(parts, unparsedArgs) {
      material = unparsedArgs;
      newGeometry();
    },
    g(parts) {
      groups = parts;
      newGeometry();
    },
    o(parts, unparsedArgs) {
      object = unparsedArgs;
      newGeometry();
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split('\n');
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  // remove any arrays that have no entries.
  for (const geometry of geometries) {
    geometry.data = Object.fromEntries(
        Object.entries(geometry.data).filter(([, array]) => array.length > 0));
  }

  return {
    geometries,
    materialLibs,
  };
}

function parseMapArgs(unparsedArgs) {
  // TODO: handle options
  return unparsedArgs;
}

function parseMTL(text) {
  const materials = {};
  let material;

  const keywords = {
    newmtl(parts, unparsedArgs) {
      material = {};
      materials[unparsedArgs] = material;
    },
    /* eslint brace-style:0 */
    Ns(parts)       { material.shininess      = parseFloat(parts[0]); },
    Ka(parts)       { material.ambient        = parts.map(parseFloat); },
    Kd(parts)       { material.diffuse        = parts.map(parseFloat); },
    Ks(parts)       { material.specular       = parts.map(parseFloat); },
    Ke(parts)       { material.emissive       = parts.map(parseFloat); },
    map_Kd(parts, unparsedArgs)   { material.diffuseMap = parseMapArgs(unparsedArgs); },
    map_Ns(parts, unparsedArgs)   { material.specularMap = parseMapArgs(unparsedArgs); },
    map_Bump(parts, unparsedArgs) { material.normalMap = parseMapArgs(unparsedArgs); },
    Ni(parts)       { material.opticalDensity = parseFloat(parts[0]); },
    d(parts)        { material.opacity        = parseFloat(parts[0]); },
    illum(parts)    { material.illum          = parseInt(parts[0]); },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split('\n');
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  return materials;
}

function makeIndexIterator(indices) {
  let ndx = 0;
  const fn = () => indices[ndx++];
  fn.reset = () => { ndx = 0; };
  fn.numElements = indices.length;
  return fn;
}

function makeUnindexedIterator(positions) {
  let ndx = 0;
  const fn = () => ndx++;
  fn.reset = () => { ndx = 0; };
  fn.numElements = positions.length / 3;
  return fn;
}

const subtractVector2 = (a, b) => a.map((v, ndx) => v - b[ndx]);

function generateTangents(position, texcoord, indices) {
  const getNextIndex = indices ? makeIndexIterator(indices) : makeUnindexedIterator(position);
  const numFaceVerts = getNextIndex.numElements;
  const numFaces = numFaceVerts / 3;

  const tangents = [];
  for (let i = 0; i < numFaces; ++i) {
    const n1 = getNextIndex();
    const n2 = getNextIndex();
    const n3 = getNextIndex();

    const p1 = position.slice(n1 * 3, n1 * 3 + 3);
    const p2 = position.slice(n2 * 3, n2 * 3 + 3);
    const p3 = position.slice(n3 * 3, n3 * 3 + 3);

    const uv1 = texcoord.slice(n1 * 2, n1 * 2 + 2);
    const uv2 = texcoord.slice(n2 * 2, n2 * 2 + 2);
    const uv3 = texcoord.slice(n3 * 2, n3 * 2 + 2);

    const dp12 = m4.subtractVectors(p2, p1);
    const dp13 = m4.subtractVectors(p3, p1);

    const duv12 = subtractVector2(uv2, uv1);
    const duv13 = subtractVector2(uv3, uv1);


    const f = 1.0 / (duv12[0] * duv13[1] - duv13[0] * duv12[1]);
    const tangent = Number.isFinite(f)
      ? m4.normalize(m4.scaleVector(m4.subtractVectors(
          m4.scaleVector(dp12, duv13[1]),
          m4.scaleVector(dp13, duv12[1]),
        ), f))
      : [1, 0, 0];

    tangents.push(...tangent, ...tangent, ...tangent);
  }

  return tangents;
}

async function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }

  // Tell the twgl to match position with a_position etc..
  twgl.setAttributePrefix("a_");

  const vs = `#version 300 es
  in vec4 a_position;
  in vec3 a_normal;
  in vec3 a_tangent;
  in vec2 a_texcoord;
  in vec4 a_color;

  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform mat4 u_world;
  uniform vec3 u_viewWorldPosition;

  out vec3 v_normal;
  out vec3 v_tangent;
  out vec3 v_surfaceToView;
  out vec2 v_texcoord;
  out vec4 v_color;

  void main() {
    vec4 worldPosition = u_world * a_position;
    gl_Position = u_projection * u_view * worldPosition;
    v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;

    mat3 normalMat = mat3(u_world);
    v_normal = normalize(normalMat * a_normal);
    v_tangent = normalize(normalMat * a_tangent);

    v_texcoord = a_texcoord;
    v_color = a_color;
  }
  `;

  const fs = `#version 300 es
  precision highp float;

  in vec3 v_normal;
  in vec3 v_tangent;
  in vec3 v_surfaceToView;
  in vec2 v_texcoord;
  in vec4 v_color;

  uniform vec3 diffuse;
  uniform sampler2D diffuseMap;
  uniform vec3 ambient;
  uniform vec3 emissive;
  uniform vec3 specular;
  uniform sampler2D specularMap;
  uniform float shininess;
  uniform sampler2D normalMap;
  uniform float opacity;
  uniform vec3 u_lightDirection;
  uniform vec3 u_ambientLight;

  out vec4 outColor;

  void main () {
    vec3 normal = normalize(v_normal) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
    vec3 tangent = normalize(v_tangent) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
    vec3 bitangent = normalize(cross(normal, tangent));

    mat3 tbn = mat3(tangent, bitangent, normal);
    normal = texture(normalMap, v_texcoord).rgb * 2. - 1.;
    normal = normalize(tbn * normal);

    vec3 surfaceToViewDirection = normalize(v_surfaceToView);
    vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);

    float fakeLight = dot(u_lightDirection, normal) * .5 + .5;
    float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);
    vec4 specularMapColor = texture(specularMap, v_texcoord);
    vec3 effectiveSpecular = specular * specularMapColor.rgb;

    vec4 diffuseMapColor = texture(diffuseMap, v_texcoord);
    vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;
    float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;

    outColor = vec4(
        emissive +
        ambient * u_ambientLight +
        effectiveDiffuse * fakeLight +
        effectiveSpecular * pow(specularLight, shininess),
        effectiveOpacity);
  }
  `;

  async function loadObjMtl(path) {
    var responseObj = await fetch("./models/" + path + ".obj");
    var textObj = await responseObj.text();
    var obj = parseOBJ(textObj);
    var responseMtl = await fetch("./models/" + path + ".mtl");
    var textMtl = await responseMtl.text();
    var materials = parseMTL(textMtl);
    return [obj, materials];
  }
  // compiles and links the shaders, looks up attribute and uniform locations
  const meshProgramInfo = twgl.createProgramInfo(gl, [vs, fs]);
  var [casaObj, casaMaterials] = await loadObjMtl("casa");
  var [fishObj, fishMaterials] = await loadObjMtl("fish");

  var textures = {
    defaultWhite: twgl.createTexture(gl, {src: [255, 255, 255, 255]}),
    defaultNormal: twgl.createTexture(gl, {src: [127, 127, 255, 0]}),
  };


  function loadTextures(obj, materials, path) {
    // load texture for materials
    for (const material of Object.values(materials)) {
      Object.entries(material)
        .filter(([key]) => key.endsWith('Map'))
        .forEach(([key, filename]) => {
          let texture = textures[filename];
          if (!texture) {
            texture = twgl.createTexture(gl, {src: "/models/" + filename, flipY: true});
            textures[filename] = texture;
          }
          material[key] = texture;
        });
    }

    obj.materials = materials;
  }

  loadTextures(casaObj, casaMaterials, "textur.jpg");
  loadTextures(fishObj, fishMaterials, "fish_texture.png");
  console.log(casaMaterials);

  const defaultMaterial = {
    diffuse: [1, 1, 1],
    diffuseMap: textures.defaultWhite,
    normalMap: textures.defaultNormal,
    ambient: [0, 0, 0],
    specular: [1, 1, 1],
    specularMap: textures.defaultWhite,
    shininess: 400,
    opacity: 1,
  };

  function objPrep(obj) {
    const parts = obj.geometries.map(({material, data}) => {  
      if (data.color) {
        if (data.position.length === data.color.length) {
          // it's 3. The our helper library assumes 4 so we need
          // to tell it there are only 3.
          data.color = { numComponents: 3, data: data.color };
        }
      } else {
        // there are no vertex colors so just use constant white
        data.color = { value: [1, 1, 1, 1] };
      }
  
      // generate tangents if we have the data to do so.
      if (data.texcoord && data.normal) {
        data.tangent = generateTangents(data.position, data.texcoord);
      } else {
        // There are no tangents
        data.tangent = { value: [1, 0, 0] };
      }
  
      if (!data.texcoord) {
        data.texcoord = { value: [0, 0] };
      }
  
      if (!data.normal) {
        // we probably want to generate normals if there are none
        data.normal = { value: [0, 0, 1] };
      }
  
      // create a buffer for each array by calling
      // gl.createBuffer, gl.bindBuffer, gl.bufferData
      const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);

      const vao = twgl.createVAOFromBufferInfo(gl, meshProgramInfo, bufferInfo);
      return {
        material: {
          ...defaultMaterial,
          ...obj.materials[material],
        },
        bufferInfo,
        vao,
      };
    });

    return parts;
  }

  var casaModel = objPrep(casaObj);
  casaModel.worldMatrix = m4.translation(20, 0, 40);
  
  var fishModel = objPrep(fishObj);
  fishModel.worldMatrix = m4.translation(40, 0, 40);
  fishModel.translationSum = 0;
  var allModels = [casaModel, fishModel];

  
  console.log("------------");
  console.log(casaModel);
  const zNear = 10;
  const zFar = 1000;

  function degToRad(deg) {
    return deg * Math.PI / 180;
  }
  	
/* 	var pointA = [20, 10, -40];
	var pointB = [20, 10, 40];	 */

  // A = [2, 10, 8];
  // B = [0.6349, 10, 7.0151];
  // C = [1.1108, 10, 1.3021];
  // D = [3.9012, 10, 1.6186];
  // E = [2, 10, 5];
  // c1 = [1.8377, 10, 7.5043]
  // c2 = [1.0873, 10, 8.2781]
  // c3 = [0.2277, 10, 5.8783];
  // c4 = [-0.2492, 10, 2.6621]
  // c5 = [2.3348, 10, 0.0780];
  // c6 = [5.0736, 10, 5.3235];
  // c7 = [2.8460, 10, -1.7157];
  // c8 = [4.3467, 10, 9.1574];
  // [20.839534425497, 10 ,64.725923420933]
  var pointA = [20, 10, 80];
  var pointB = [6.349, 10, 70.151];

  var pointC = [11.108, 10, 13.021];
  var pointD = [39.012, 10, 16.186];
  var pointE = [20, 10, 50];

  var pointC1 = [20.839534425497, 10 ,64.725923420933];
  var pointC2 = [10.873, 10, 82.781];
  var pointC3 = [2.277, 10, 58.783];
  var pointC4 = [-2.492, 10, 26.621];
  var pointC5 = [23.348, 10, 0.780];
  var pointC6 = [50.736, 10, 53.235];
  var pointC7 = [28.460, 10, -17.157];
  var pointC8 = [43.467, 10, 91.574];

	//var cameraMovementSpeed = 1;

	function pointSum(A, B) {
		return [A[0] + B[0], A[1] + B[1], A[2] + B[2]];
	}
	
  function sumPointList(pointList) {
    var sum = [0, 0, 0];
    for (let i = 0; i < pointList.length; i++) {
      sum[0] += pointList[i][0];
      sum[1] += pointList[i][1];
      sum[2] += pointList[i][2];
    }
    return sum;
  }

	function pointMultiplyScalar(A, s) {
		return [A[0] * s, A[1] * s, A[2] * s];
	}

  // (1-t)^(3)A + 3t(1-t)^(2)c1 + 3t^(2)(1-t)c2 + t^(3)B
	function bezierCurve(A, B, c1, c2, t, i) {
		var firstTerm = pointMultiplyScalar(A, (1 - t + i) ** 3);
		var secondTerm = pointMultiplyScalar(c1, 3 * ((1 - t + i) ** 2) * (t - i));
		var thirdTerm = pointMultiplyScalar(c2, 3 * (1 - t + i) * ((t - i) ** 2));
		var fourthTerm = pointMultiplyScalar(B, (t - i) ** 3);
		return pointSum(firstTerm, pointSum(secondTerm, pointSum(thirdTerm, fourthTerm)));
	}

  var curves = [(t) => bezierCurve(pointA, pointB, pointC1, pointC2, t, 0),
                (t) => bezierCurve(pointB, pointC, pointC3, pointC4, t, 1),
                (t) => bezierCurve(pointC, pointD, pointC5, pointC6, t, 2),
                (t) => bezierCurve(pointD, pointE, pointC7, pointC8, t, 3)];

  var then = 0;
	var timeSum = 0;
  const numCurves = curves.length;

  var controls = new function() {
    this.t = 0;
    this.animationDuration = 10;
    /* this.x = 20
    this.y = 10;
    this.z = 80; */
  }

  var gui = new dat.GUI();
  gui.add(controls, 't', 0, numCurves).listen();
 /*  gui.add(controls, 'x', -100, 100);
  gui.add(controls, 'y', -100, 100);
  gui.add(controls, 'z', -100, 100); */
  var controlAnimationDuration = gui.add(controls, 'animationDuration', 1, 100);
  controlAnimationDuration.onChange(function(value) {
    playing = false;
    timeSum = 0;
    controls.t = 0;
  });

  controlAnimationDuration.domElement.id = "animationDuration";
  var playing = false;
  var buttons = { play:function(){ playing=true },
  pause: function() { playing=false; },
  reset: function() { playing=false; controls.t = 0; timeSum = 0;}
  };
  gui.add(buttons,'play');
  gui.add(buttons,'pause');
  gui.add(buttons,'reset');

  function render(time) {
    console.log(controls.t);
    time *= 0.001;  // convert to seconds
    var deltaTime = time - then;
  	if (playing) { 
      timeSum += deltaTime;
      if (timeSum > controls.animationDuration) {
        timeSum = 0;
      }
      controls.t = (timeSum / controls.animationDuration) * numCurves;
  	  if (controls.t > numCurves) controls.t = numCurves;
    }
    then = time;
    var curveNum = Math.floor(controls.t);
    if(curveNum >= numCurves) curveNum = numCurves - 1;
    var cameraPosition = curves[curveNum](controls.t);
    var cameraTarget = curves[curveNum](controls.t + 0.01);

    fishModel.translationSum += 0.005;
    fishModel.translate = [0, Math.sin(fishModel.translationSum) * 10, 0];
    fishModel.worldMatrix = m4.translate(fishModel.worldMatrix, ...fishModel.translate);
    console.log(fishModel.translate);
    /* var cameraPosition = [controls.x, controls.y, controls.z];
    var cameraTarget = [20, 0, 40]; */
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    /* gl.enable(gl.CULL_FACE); */
    gl.enable(gl.DEPTH_TEST);

    gl.clearColor(0, 0.5, 0.5, 1);
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
      u_lightDirection: m4.normalize([-5, 1, 5]),
      u_view: view,
      u_projection: projection,
      u_viewWorldPosition: cameraPosition,
    };

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

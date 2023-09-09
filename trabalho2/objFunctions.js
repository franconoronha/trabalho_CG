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


async function loadObjMtl(path) {
    var responseObj = await fetch("./models/" + path + ".obj");
    var textObj = await responseObj.text();
    var obj = parseOBJ(textObj);
    var responseMtl = await fetch("./models/" + path + ".mtl");
    var textMtl = await responseMtl.text();
    var materials = parseMTL(textMtl);
    return [obj, materials];
}
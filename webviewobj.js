import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/orbitcontrols.js';
import { OBJLoader } from './three/OBJLoader.js';
import { GUI } from './three/dat.gui.module.js';
import {
    vertexShaderToon, fragShaderToon,
    vertexShaderOutline, fragShaderOutline,
    vertexShaderMask, fragShaderMask,
    vertexShaderEdge, fragShaderEdge
} from "./shaderLib.js"


let domElement = document.getElementById("avatarDom");
let canvasW = domElement.clientWidth;
let canvasH = domElement.clientHeight;

let renderer = new THREE.WebGLRenderer();
domElement.appendChild(renderer.domElement);

let modelgroup = new THREE.Group();
let modelgroupOutline = new THREE.Group();
let modelgroupMask = new THREE.Group();

let scene = new THREE.Scene();
// scene.background = new THREE.Color(0xa0a0a0);
renderer.setSize(canvasW, canvasH);
scene.add(modelgroup);

var camera = new THREE.PerspectiveCamera(45, 500 / 500, 1, 2000);
camera.position.y = 400;
camera.lookAt(scene.position);
camera.aspect = canvasW / canvasH;
camera.updateProjectionMatrix();
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 25, 0);
controls.update();

// 显示光照示意盒
// var material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
// var object = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), material);
// object.position.set(0, 0, 100)
// scene.add(object);


let outLineType = 2;

// 用于法线扩张描边的渲染（2 pass）
let outlineScene = new THREE.Scene();
outlineScene.background = new THREE.Color(0xa0a0a0);
outlineScene.add(modelgroupOutline);


// 用于卷积描边的渲染（需要先渲染一个maskScene，再输出给edgeScene，最后与原始渲染结果叠加，共 3 pass）
let maskScene = new THREE.Scene();
maskScene.add(modelgroupMask);
let maskBuffer = new THREE.WebGLRenderTarget(canvasW, canvasH, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    antialias: true
});
maskBuffer.texture.generateMipmaps = false;
let edgeMaterial = new THREE.ShaderMaterial({
    vertexShader: vertexShaderEdge,
    fragmentShader: fragShaderEdge,
    depthTest: false,
    uniforms: {
        maskTexture: {
            value: maskBuffer.texture
        },
        texSize: {
            value: new THREE.Vector2(canvasW, canvasH)
        },
        color: {
            value: new THREE.Color(0.0, 0.0, 0.0)
        },
        thickness: {
            type: 'f',
            value: 1.6
        },
        transparent: true
    },
});
let edgeObj = new THREE.Mesh(new THREE.PlaneBufferGeometry(canvasW, canvasH), edgeMaterial);
edgeObj.frustumCulled = false;
// edgeScene渲染在一张平面上，不随controller转动，所以需要一个新的正交相机
let edgeScene = new THREE.Scene();
edgeScene.add(edgeObj);
var edgeCamera = new THREE.OrthographicCamera(-canvasW / 2, canvasW / 2, canvasH / 2, -canvasH / 2, 0, 1);
edgeCamera.position.z = 1;
edgeCamera.lookAt(new THREE.Vector3());

renderer.autoClear = false;//防止渲染器在渲染每一帧之前自动清除其输出
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.clear();
    let oldRenderTarget = renderer.getRenderTarget();

    if (outLineType == 2) {
        // 改变renderTarget，从屏幕到maskBuffer纹理
        renderer.setRenderTarget(maskBuffer);
        renderer.clear();
        renderer.render(maskScene, camera);
        // 重置renderTarget，交还给屏幕
        renderer.setRenderTarget(oldRenderTarget);
        // 渲染edgeScene，其中输入纹理为maskBuffer
        renderer.render(edgeScene, edgeCamera);
        renderer.clearDepth();
        // 渲染原始图像
        renderer.render(scene, camera);
    } else if (outLineType == 1) {
        // 先渲染法线扩张后的黑底，再渲染原始图像
        renderer.render(outlineScene, camera);
        renderer.clearDepth();
        renderer.render(scene, camera);
    } else {
        renderer.render(scene, camera);
    }
}
animate();

// 准备几何体
let myOBJLoader = new OBJLoader();
myOBJLoader.load('./models/pikachiu-obj/pikachiu.obj', function (obj) {
    obj.scale.set(15, 15, 15); //放大obj组对象
    const textureBase = new THREE.TextureLoader().load("/models/pikachiu-obj/initialShadingGroup_Base_Color.png");
    textureBase.magFilter = THREE.NearestFilter;
    textureBase.minFilter = THREE.NearestFilter;

    obj.children[0].material = new THREE.ShaderMaterial({
        uniforms: {
            offset: {
                type: 'f',
                value: 0.05  //偏移值
            },
            color: {
                value: new THREE.Color(0.0, 0.0, 0.0)
            },
            _MainTex: {
                value: textureBase
            },
            light: {        // 光源位置
                type: 'v3',
                value: new THREE.Vector3(0, 0, 100)
            },
            isHighlight: {
                value: 1
            },
            isRimlight: {
                value: 1
            },
            isDimtoon: {
                value: 1
            },
            hasSkinMap: {
                value: 0
            }
        },
        vertexShader: vertexShaderToon,
        fragmentShader: fragShaderToon
    });;
    modelgroup.add(obj);//返回的组对象插入场景中


    let objOutlineGeo = new THREE.BufferGeometry();
    objOutlineGeo.copy(obj.children[0].geometry);
    let objOutline = new THREE.Mesh(objOutlineGeo);
    objOutline.scale.set(15, 15, 15); //放大obj组对象
    objOutline.material = new THREE.ShaderMaterial({
        uniforms: {
            offset: {
                type: 'f',
                value: 0.05  //偏移值
            },
            color: {
                value: new THREE.Color(0.0, 0.0, 0.0)
            },
        },
        vertexShader: vertexShaderOutline,
        fragmentShader: fragShaderOutline
    });
    modelgroupOutline.add(objOutline)

    let objMaskGeo = new THREE.BufferGeometry();
    objMaskGeo.copy(obj.children[0].geometry);
    let objMask = new THREE.Mesh(objMaskGeo);
    objMask.scale.set(15, 15, 15); //放大obj组对象
    objMask.material = new THREE.ShaderMaterial({
        vertexShader: vertexShaderMask,
        fragmentShader: fragShaderMask,
        depthTest: false
    });
    modelgroupMask.add(objMask)
})

// 准备效果控制条
const gui = new GUI({ width: 300 });
gui.add({ '是否显示高光': true }, '是否显示高光').onChange(function (value) {
    if (value) {
        scene.traverse(function (obj) {
            if (obj.type === "Mesh") {
                obj.material.uniforms.isHighlight.value = 1;
            }
        });
    } else {
        scene.traverse(function (obj) {
            if (obj.type === "Mesh") {
                obj.material.uniforms.isHighlight.value = 0;
            }
        });
    }
});

gui.add({ '是否显示RimLight': true }, '是否显示RimLight').onChange(function (value) {
    if (value) {
        scene.traverse(function (obj) {
            if (obj.type === "Mesh") {
                obj.material.uniforms.isRimlight.value = 1;
            }
        });
    } else {
        scene.traverse(function (obj) {
            if (obj.type === "Mesh") {
                obj.material.uniforms.isRimlight.value = 0;
            }
        });
    }
});

gui.add({ '是否显示硬阴影': true }, '是否显示硬阴影').onChange(function (value) {
    if (value) {
        scene.traverse(function (obj) {
            if (obj.type === "Mesh") {
                obj.material.uniforms.isDimtoon.value = 1;
            }
        });
    } else {
        scene.traverse(function (obj) {
            if (obj.type === "Mesh") {
                obj.material.uniforms.isDimtoon.value = 0;
            }
        });
    }
});

gui.add({ '描边类型': '卷积边缘检测' }, '描边类型', ['卷积边缘检测', '法线扩张', '不描边']).onChange(function (value) {
    if (value == '卷积边缘检测') {
        scene.background = null;
        outLineType = 2;
    } else if (value == '法线扩张') {
        scene.background = null;
        outLineType = 1;
    } else {
        outLineType = 0;
        scene.background = new THREE.Color(0xa0a0a0);
    }
});

gui.addColor({ '描边颜色': [0.0, 0.0, 0.0] }, '描边颜色').onChange(function (value) {
    edgeMaterial.uniforms.color.value.set(new THREE.Color(value[0] / 256.0, value[1] / 256.0, value[2] / 256.0));
    outlineScene.traverse(function (obj) {
        if (obj.type === "Mesh" && obj.material.type == "ShaderMaterial") {
            obj.material.uniforms.color.value.set(new THREE.Color(value[0] / 256.0, value[1] / 256.0, value[2] / 256.0));
        }
    });
});


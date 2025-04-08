import { resizeAspectRatio, setupText } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';

let canvas = document.getElementById('glCanvas');
let gl = canvas.getContext('webgl2');
let shader;
let squareVAO;
let axesVAO;
let textOverlay;
let isInitialized = false;
let sunAngle = 0;
let earthAngle = 0;
let earthOrbit = 0;
let moonAngle = 0;
let moonOrbit = 0;
let lastTime = 0;

const DEG2RAD = Math.PI / 180;




document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) {
        console.log("Already initialized");
        return;
    }

    main().then(success => {
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
        requestAnimationFrame(animate);
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
    });
});

function initWebGL() {
    if (!gl) return false;
    canvas.width = 700;
    canvas.height = 700;
    resizeAspectRatio(gl, canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.2, 0.3, 0.4, 1.0);
    return true;
}


function setupAxesBuffers(shader) {
    axesVAO = gl.createVertexArray();
    gl.bindVertexArray(axesVAO);

    const axesVertices = new Float32Array([
        -1, 0.0, 1, 0.0,  // x축
        0.0, -1, 0.0, 1   // y축
    ]);

    const axesColors = new Float32Array([
        1.0, 0.3, 0.0, 1.0, 1.0, 0.3, 0.0, 1.0,  // x축 색상
        0.0, 1.0, 0.5, 1.0, 0.0, 1.0, 0.5, 1.0   // y축 색상
    ]);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, axesVertices, gl.STATIC_DRAW);
    shader.setAttribPointer("a_position", 2, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, axesColors, gl.STATIC_DRAW);
    shader.setAttribPointer("a_color", 4, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
}

function setupSquareBuffers(shader) {
    const size = 0.5;
    const vertices = new Float32Array([
        -size,  size,
        -size, -size,
         size, -size,
         size,  size
    ]);

    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    squareVAO = gl.createVertexArray();
    gl.bindVertexArray(squareVAO);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    shader.setAttribPointer("a_position", 2, gl.FLOAT, false, 0, 0);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
}

function drawSquare(transform, color) {
    shader.setMat4("u_model", transform);
    shader.setVec4("u_color", color);
    gl.bindVertexArray(squareVAO);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

function animate(currentTime) {
    if (!lastTime) lastTime = currentTime;
    const delta = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    sunAngle += 45 * DEG2RAD * delta;
    earthAngle += 180 * DEG2RAD * delta;
    earthOrbit += 30 * DEG2RAD * delta;
    moonAngle += 180 * DEG2RAD * delta;
    moonOrbit += 360 * DEG2RAD * delta;

    render();
    requestAnimationFrame(animate);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    shader.use();

    shader.setMat4("u_model", mat4.create());
    gl.bindVertexArray(axesVAO);

    shader.setVec4("u_color", [1, 0.3, 0, 1]);
    gl.drawArrays(gl.LINES, 0, 2);

    
    shader.setVec4("u_color", [0, 1, 0.5, 1]);
    gl.drawArrays(gl.LINES, 2, 2);
    
    
    // Sun
    let sun = mat4.create();
    mat4.rotate(sun, sun, sunAngle, [0, 0, 1]);
    mat4.scale(sun, sun, [0.2, 0.2, 1]);
    drawSquare(sun, [1, 0, 0, 1]);

    // Earth
    let earth = mat4.create();
    mat4.rotate(earth, earth, earthOrbit, [0, 0, 1]);
    mat4.translate(earth, earth, [0.7, 0, 0]);
    mat4.rotate(earth, earth, earthAngle, [0, 0, 1]);
    mat4.scale(earth, earth, [0.1, 0.1, 1]);
    drawSquare(earth, [0, 1, 1, 1]);

    // Moon
    let moon = mat4.create();
    mat4.rotate(moon, moon, earthOrbit, [0, 0, 1]);
    mat4.translate(moon, moon, [0.7, 0, 0]);
    mat4.rotate(moon, moon, moonOrbit, [0, 0, 1]);
    mat4.translate(moon, moon, [0.2, 0, 0]);
    mat4.rotate(moon, moon, moonAngle, [0, 0, 1]);
    mat4.scale(moon, moon, [0.05, 0.05, 1]);
    drawSquare(moon, [1, 1, 0, 1]);
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    return new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
        }

        shader = await initShader();
        setupAxesBuffers(shader);
        setupSquareBuffers(shader);
        shader.use();
        requestAnimationFrame(animate);
        return true;
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}




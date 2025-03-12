const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");

canvas.width = 100;
canvas.height = 100;

render();

function render() {
    const halfWidth = canvas.width / 2;
    const halfHeight = canvas.height / 2;

    gl.enable(gl.SCISSOR_TEST); 

    // Top-left (Red)
    gl.viewport(0, halfHeight, halfWidth, halfHeight);
    gl.scissor(0, halfHeight, halfWidth, halfHeight);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Top-right (Green)
    gl.viewport(halfWidth, halfHeight, halfWidth, halfHeight);
    gl.scissor(halfWidth, halfHeight, halfWidth, halfHeight);
    gl.clearColor(0, 1, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Bottom-left (Blue)
    gl.viewport(0, 0, halfWidth, halfHeight);
    gl.scissor(0, 0, halfWidth, halfHeight);
    gl.clearColor(0, 0, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Bottom-right (Yellow)
    gl.viewport(halfWidth, 0, halfWidth, halfHeight);
    gl.scissor(halfWidth, 0, halfWidth, halfHeight);
    gl.clearColor(1, 1, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.disable(gl.SCISSOR_TEST);
}

function resizeCanvas() {
    let size = Math.min(window.innerHeight,window.innerWidth)
    canvas.width = size;
    canvas.height = size;
    gl.viewport(0, 0, canvas.width, canvas.height);
    render();
}


window.addEventListener("resize", resizeCanvas);
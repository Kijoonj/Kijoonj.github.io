#version 300 es
precision mediump float;

uniform vec4 u_color;
in vec4 v_color;
out vec4 outColor;

void main() {
    outColor = u_color;
}

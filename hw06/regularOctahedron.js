/*-----------------------------------------------------------------------------
class Cube

1) Vertex positions
    A cube has 6 faces and each face has 4 vertices
    The total number of vertices is 24 (6 faces * 4 verts)
    So, vertices need 72 floats (24 * 3 (x, y, z)) in the vertices array

2) Vertex indices
    Vertex indices of the unit cube is as follows:
     v6----- v5
     /|      /|
    v1------v0|
    | |     | |
    | v7----|-v4
    |/      |/
    v2------v3

    The order of faces and their vertex indices is as follows:
        front (0,1,2,3), right (0,3,4,5), top (0,5,6,1), 
        left (1,6,7,2), bottom (7,4,3,2), back (4,7,6,5)
    Note that each face has two triangles, 
    so the total number of triangles is 12 (6 faces * 2 triangles)
    And, we need to maintain the order of vertices for each triangle as 
    counterclockwise (when we see the face from the outside of the cube):
        front [(0,1,2), (2,3,0)]
        right [(0,3,4), (4,5,0)]
        top [(0,5,6), (6,1,0)]
        left [(1,6,7), (7,2,1)]
        bottom [(7,4,3), (3,2,7)]
        back [(4,7,6), (6,5,4)]

3) Vertex normals
    Each vertex in the same face has the same normal vector (flat shading)
    The normal vector is the same as the face normal vector
    front face: (0,0,1), right face: (1,0,0), top face: (0,1,0), 
    left face: (-1,0,0), bottom face: (0,-1,0), back face: (0,0,-1) 

4) Vertex colors
    Each vertex in the same face has the same color (flat shading)
    The color is the same as the face color
    front face: red (1,0,0,1), right face: yellow (1,1,0,1), top face: green (0,1,0,1), 
    left face: cyan (0,1,1,1), bottom face: blue (0,0,1,1), back face: magenta (1,0,1,1) 

5) Vertex texture coordinates
    Each vertex in the same face has the same texture coordinates (flat shading)
    The texture coordinates are the same as the face texture coordinates
    front face: v0(1,1), v1(0,1), v2(0,0), v3(1,0)
    right face: v0(0,1), v3(0,0), v4(1,0), v5(1,1)
    top face: v0(1,0), v5(0,0), v6(0,1), v1(1,1)
    left face: v1(1,0), v6(0,0), v7(0,1), v2(1,1)
    bottom face: v7(0,0), v4(0,1), v3(1,1), v2(1,0)
    back face: v4(0,0), v7(0,1), v6(1,1), v5(1,0)

6) Parameters:
    1] gl: WebGLRenderingContext
    2] options:
        1> color: array of 4 floats (default: [0.8, 0.8, 0.8, 1.0 ])
           in this case, all vertices have the same given color

7) Vertex shader: the location (0: position attrib (vec3), 1: normal attrib (vec3),
                            2: color attrib (vec4), and 3: texture coordinate attrib (vec2))
8) Fragment shader: should catch the vertex color from the vertex shader
-----------------------------------------------------------------------------*/

export class regularOctahedron {
    constructor(gl, options = {}) {
        this.gl = gl;

        const height = Math.sqrt(0.5); 

        
        this.vertices = new Float32Array([
            0.0,  height,  0.0,    
            0.5,  0.0,  0.5,         
           -0.5,  0.0,  0.5,        
           -0.5,  0.0, -0.5,       
            0.5,  0.0, -0.5,       
            0.0, -height, 0.0    
        ]);

        this.indices = new Uint16Array([
            0, 1, 2,  
            0, 2, 3, 
            0, 3, 4,  
            0, 4, 1,  
            5, 2, 1,  
            5, 3, 2, 
            5, 4, 3, 
            5, 1, 4   
        ]);

        
        this.normals = new Float32Array(this.vertices.length);
        for (let i = 0; i < this.vertices.length; i += 3) {
            const x = this.vertices[i];
            const y = this.vertices[i+1];
            const z = this.vertices[i+2];
            const len = Math.hypot(x,y,z);
            this.normals[i] = x / len;
            this.normals[i+1] = y / len;
            this.normals[i+2] = z / len;
        }

        
        this.texCoords = new Float32Array([
            0.5, 1.0,   
            1.0, 0.5,   
            0.0, 0.5,   
            0.0, 0.0,   
            1.0, 0.0,   
            0.5, -0.5   
        ]);

       
        
        this.colors = new Float32Array([
            1,1,1,1,
            1,1,1,1,
            1,1,1,1,
            1,1,1,1,
            1,1,1,1,
            1,1,1,1
        ]);
        

        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        this.ebo = gl.createBuffer();

        this.initBuffers();
    }

    initBuffers() {
        const gl = this.gl;

        const vSize = this.vertices.byteLength;
        const nSize = this.normals.byteLength;
        const cSize = this.colors.byteLength;
        const tSize = this.texCoords.byteLength;
        const totalSize = vSize + nSize + cSize + tSize;

        gl.bindVertexArray(this.vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, totalSize, gl.STATIC_DRAW);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize, this.normals);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize+nSize, this.colors);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize+nSize+cSize, this.texCoords);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, vSize);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, vSize+nSize);
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, vSize+nSize+cSize);

        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        gl.enableVertexAttribArray(3);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }

    draw(shader) {
        const gl = this.gl;
        shader.use();
        gl.bindVertexArray(this.vao);
        gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);
    }
}

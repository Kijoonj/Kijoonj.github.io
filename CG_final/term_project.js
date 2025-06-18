import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { initStats, initRenderer, initCamera } from './util.js';

// 씬, 렌더러, 카메라 초기화
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const renderer = initRenderer();
const camera = initCamera();
const stats = initStats();
const clock = new THREE.Clock();

// 그림자 활성화 (성능 최적화)
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap에서 PCFShadowMap으로 변경 (성능 향상)

// 성능 최적화 설정
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 픽셀 비율 제한

// Raycaster 설정 (벽 감지용)
const raycaster = new THREE.Raycaster();

// 타이머 설정
let timerStarted = false;
let gameStartTime = null;
let timerInterval = null;
const GAME_DURATION = 60; // 60초 (1분)
let gameCompleted = false;
let gameStarted = false; // 게임 시작 여부

// 카메라 초기 위치 설정 (방 안쪽)
camera.position.set(0, 5, 10);

// PointerLock 컨트롤 설정 (FPS 스타일)
const controls = new PointerLockControls(camera, document.body);

// 움직임 변수들
const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    crouching: false  // 앉기 상태
};

const velocity = new THREE.Vector3();
const moveSpeed = 50.0; // 이동속도 150.0에서 50.0으로 줄임
const jumpHeight = 80.0;

// 바닥 기준 높이 설정
let floorY = 0;
const playerHeight = 2; // 플레이어 눈 높이

// 방 1 충돌 경계 설정
const room1Boundaries = {
    minX: -5.89,
    maxX: 5.94,
    minZ: -5.87,
    maxZ: 5.87,
    // 문 구간 (z = 5.87에서 x = 3.23 ~ 4.53)
    doorMinX: 3.23,
    doorMaxX: 4.53,
    doorZ: 5.87
};

// 방 2 충돌 경계 설정
const room2Boundaries = {
    minX: 2.40,
    maxX: 9.78,
    minZ: 6.66,
    maxZ: 14.40,
    // 문 구간 (z = 6.66에서 x = 3.23 ~ 4.53) - 방 1과 연결
    doorMinX: 3.23,
    doorMaxX: 4.53,
    doorZ: 6.66
};

// 플레이어와 벽 사이의 최소 거리 (충돌 여유 공간)
const wallMargin = 0.5;

// 조명 설정 함수 (성능 최적화)
function setupLighting() {
    const spotLight1 = new THREE.SpotLight(0xffffff, 3.0);
    spotLight1.position.set(6.0, 6.0, 10.5); // 방 2 중앙 위쪽
    spotLight1.target.position.set(2.5, 2.0, 10.5); // 왼쪽 벽면을 향함
    spotLight1.angle = Math.PI / 6; // 30도 각도
    spotLight1.penumbra = 0.3; // 부드러운 가장자리
    spotLight1.decay = 1;
    spotLight1.distance = 15;
    spotLight1.castShadow = true;
    spotLight1.shadow.mapSize.width = 1024;
    spotLight1.shadow.mapSize.height = 1024;
    scene.add(spotLight1);
    scene.add(spotLight1.target);
    // 주변광 강도 증가로 포인트 라이트 수 줄이기
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambientLight);
}

// GLB 로더 설정 (room2용)
const gltfLoader = new GLTFLoader();
// FBX 로더 설정 (room1용)
const fbxLoader = new FBXLoader();
let room1Model;
let room2v2Model;
let airpodModel;

// 게임 성공 처리 함수
function completeGame() {
    if (gameCompleted) return;
    
    gameCompleted = true;
    
    // 타이머 정지
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // 성공 메시지
    const currentTime = Date.now();
    const elapsedSeconds = Math.floor((currentTime - gameStartTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    
    console.log('🎉 성공! 에어팟을 찾았습니다!');
    console.log(`⏱️ 소요 시간: ${minutes}:${seconds.toString().padStart(2, '0')}`);
    
    // 타이머를 SUCCESS로 변경
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.textContent = 'SUCCESS!';
        timerElement.style.color = '#4CAF50'; // 녹색으로 변경
    }
    
    // 마우스 락 해제
    if (controls.isLocked) {
        controls.unlock();
    }
    
    // 성공 메시지 표시
    const successMessage = document.getElementById('successMessage');
    if (successMessage) {
        successMessage.style.display = 'block';
    }
}

// 타이머 업데이트 함수 (최적화)
const timerElement = document.getElementById('timer');
const failMessage = document.getElementById('failMessage');

function updateTimer() {
    if (!timerStarted || !gameStartTime || gameCompleted) return;
    
    const remainingSeconds = Math.max(0, GAME_DURATION - Math.floor((Date.now() - gameStartTime) / 1000));
    
    if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        gameCompleted = true;
        
        // 타이머를 FAILED로 변경
        timerElement.textContent = 'FAILED!';
        timerElement.style.color = '#F44336';
        
        // 마우스 락 해제
        if (controls.isLocked) {
            controls.unlock();
        }
        
        // 실패 메시지 표시
        failMessage.style.display = 'block';
        return;
    }
    
    // 시간 표시 최적화 (템플릿 리터럴 제거)
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    timerElement.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

// 타이머 시작 함수
function startTimer() {
    if (timerStarted) return;
    
    timerStarted = true;
    gameStartTime = Date.now();
    
    // 타이머 표시
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.style.display = 'block';
    }
    
    // 1초마다 타이머 업데이트
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer(); // 즉시 첫 업데이트
}

// 로딩 완료 시 메시지 숨기기 및 인트로 표시
function hideLoadingMessage() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    
    // 인트로 메시지 표시
    const introMessage = document.getElementById('introMessage');
    if (introMessage) {
        introMessage.style.display = 'block';
    }
}

// 게임 시작 함수
function startGame() {
    if (gameStarted) return;
    
    gameStarted = true;
    
    // 인트로 메시지 숨기기
    const introMessage = document.getElementById('introMessage');
    if (introMessage) {
        introMessage.style.display = 'none';
    }
    
    // 조준점 표시
    const crosshairElement = document.getElementById('crosshair');
    if (crosshairElement) {
        crosshairElement.style.display = 'block';
    }
    
    // 포인터 락 활성화
    if (!controls.isLocked) {
        controls.lock();
    }
}

// FBX 모델 처리 함수 (성능 최적화)
function processFBXModel(object, modelName) {
    // 모델 순회하여 설정
    object.traverse(function (child) {
        // FBX 조명 처리
        if (child.isLight) {
            child.intensity *= 0.1; // FBX 조명 강도 조절
        }
        
        if (child.isMesh) {
            // 선택적 그림자 설정 (큰 객체만)
            const boundingBox = new THREE.Box3().setFromObject(child);
            const size = boundingBox.getSize(new THREE.Vector3());
            const volume = size.x * size.y * size.z;
            
            if (volume > 1.0) { // 큰 객체만 그림자 캐스팅
                child.castShadow = true;
            }
            child.receiveShadow = true;
            
            // 재질 최적화
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        optimizeMaterial(mat);
                    });
                } else {
                    optimizeMaterial(child.material);
                }
            }
        }
    });
    
    return object;
}

// 재질 최적화 함수
function optimizeMaterial(material) {
    material.needsUpdate = true;
    
    // 불필요한 기능 비활성화
    if (material.isMeshStandardMaterial) {
        // 성능을 위해 일부 기능 제한
        material.flatShading = false;
        material.precision = 'mediump'; // 중간 정밀도 사용
    }
}

// GLB 모델 처리 함수 (성능 최적화)
function processGLBModel(gltf, modelName) {
    const model = gltf.scene;
    
    // 모델 순회하여 설정
    model.traverse(function (child) {
        if (child.isMesh) {
            // 선택적 그림자 설정 (큰 객체만)
            const boundingBox = new THREE.Box3().setFromObject(child);
            const size = boundingBox.getSize(new THREE.Vector3());
            const volume = size.x * size.y * size.z;
            
            if (volume > 1.0) { // 큰 객체만 그림자 캐스팅
                child.castShadow = true;
            }
            child.receiveShadow = true;
            
            // 재질 최적화
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        optimizeGLBMaterial(mat);
                    });
                } else {
                    optimizeGLBMaterial(child.material);
                }
            }
        }
        
        // GLB에서 임포트된 조명 처리
        if (child.isLight) {
            // GLB 조명을 보조 조명으로 사용
            child.intensity *= 0.5; // 약간 줄임
        }
    });
    
    return model;
}

// GLB 재질 최적화 함수
function optimizeGLBMaterial(material) {
    if (material.isMeshStandardMaterial) {
        material.needsUpdate = true;
        material.envMapIntensity = 0.1;
        material.precision = 'mediump'; // 중간 정밀도 사용
        
        // 복잡한 기능 제한 (성능 향상)
        if (material.normalMap) {
            material.normalScale.set(0.5, 0.5); // Normal map 강도 줄임
        }
    }
}

// room2_light.glb 로드
gltfLoader.load(
    './room2.glb',  // GLB 파일로 변경
    function (gltf) {
        room2v2Model = processGLBModel(gltf, 'Room2_light');
        
        // room2_light 스케일 조정 (필요시)
        room2v2Model.scale.set(1, 1, 1); // GLB는 보통 스케일 조정이 덜 필요
        
        // room2_light 위치 조정 및 회전
        const box = new THREE.Box3().setFromObject(room2v2Model);
        const center = box.getCenter(new THREE.Vector3());
        room2v2Model.position.set(center.x + 6.3, center.y - 0.2, center.z + 10.2);
        
        // Y축 중심으로 시계 반대 방향 90도 회전
        room2v2Model.rotation.y = Math.PI / 2;
        
        scene.add(room2v2Model);
    },
    function (progress) {
        // 로딩 진행률 (콘솔 출력 제거)
    },
    function (error) {
        // Room2_light GLB 로드 실패 (콘솔 출력 제거)
    }
);

// room1.fbx 로드 
fbxLoader.load(
    './room1.fbx',  // FBX 파일 사용
    function (object) {
        room1Model = processFBXModel(object, 'Room1');
        
        // room1 스케일 조정 (FBX는 보통 스케일 조정 필요)
        room1Model.scale.set(0.01, 0.01, 0.01);
        
        // room1 위치 조정
        const box = new THREE.Box3().setFromObject(room1Model);
        const center = box.getCenter(new THREE.Vector3());
        room1Model.position.set(center.x, center.y, center.z);
        
        scene.add(room1Model);
        
        // 바닥 기준 높이 설정 및 카메라 위치 조정
        floorY = center.y;
        
        // 안전한 카메라 위치 설정 (방 1 내부)
        const safeX = Math.max(-4, Math.min(4, center.x)); // 방 1 경계 내
        const safeZ = Math.max(-4, Math.min(4, center.z)); // 방 1 경계 내
        camera.position.set(safeX, floorY + playerHeight, safeZ);
        
        // 카메라 시점을 정면으로 설정 (수평 시점)
        // PointerLockControls의 오일러 각도 직접 설정
        controls.getObject().rotation.x = 0; // 위아래 회전 제거
        controls.getObject().rotation.y = 0; // 좌우 회전 초기화
        controls.getObject().rotation.z = 0; // 기울기 제거
        
        // 카메라 초기 설정 완료 (콘솔 출력 제거)
        
        // 조명 설정 (모델 로드 후)
        setupLighting();
        
        // 에어팟 로드 (Room1 로드 완료 후)
        loadAirpod();
        
        hideLoadingMessage();
    },
    function (progress) {
        // 로딩 진행률 (콘솔 출력 제거)
    },
    function (error) {
        // Room1 FBX 로드 실패 (콘솔 출력 제거)
        hideLoadingMessage();
    }
);

// 윈도우 리사이즈 이벤트
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// PointerLock 이벤트 설정
controls.addEventListener('lock', function() {
    // 포인터 락 활성화 및 타이머 시작
    startTimer();
});

controls.addEventListener('unlock', function() {
    // 포인터 락 해제 (콘솔 출력 제거)
});

// 화면 클릭으로 게임 시작 또는 에어팟 감지
document.addEventListener('click', function() {
    // 인트로 메시지가 표시되어 있으면 게임 시작
    const introMessage = document.getElementById('introMessage');
    if (introMessage && introMessage.style.display !== 'none') {
        startGame();
        return;
    }
    
    // 게임이 시작되지 않았으면 아무것도 안함
    if (!gameStarted) {
        return;
    }
    
    if (!controls.isLocked) {
        controls.lock();
    } else {
        // 포인터 락 상태에서 클릭 시 에어팟 감지
        checkAirpodClick();
    }
});

// 키보드 이벤트 처리
document.addEventListener('keydown', function(event) {
    switch (event.code) {
        case 'KeyW':
            moveState.forward = true;
            break;
        case 'KeyA':
            moveState.left = true;
            break;
        case 'KeyS':
            moveState.backward = true;
            break;
        case 'KeyD':
            moveState.right = true;
            break;
        case 'Escape':
            if (controls.isLocked) {
                controls.unlock();
            }
            break;
        case 'KeyC':
            moveState.crouching = true;  // 앉기 시작
            break;

    }
});

document.addEventListener('keyup', function(event) {
    switch (event.code) {
        case 'KeyW':
            moveState.forward = false;
            break;
        case 'KeyA':
            moveState.left = false;
            break;
        case 'KeyS':
            moveState.backward = false;
            break;
        case 'KeyD':
            moveState.right = false;
            break;
        case 'KeyC':
            moveState.crouching = false;  // 앉기 종료
            break;
    }
});

// 현재 위치가 방 1 영역 내에 있는지 확인하는 함수 (최적화)
function isInRoom1(x, z) {
    return x >= -7.89 && x <= 7.94 && z >= -7.87 && z <= 7.87;
}

// 현재 위치가 방 2 영역 내에 있는지 확인하는 함수 (최적화)
function isInRoom2(x, z) {
    return x >= 0.40 && x <= 11.78 && z >= 4.66 && z <= 16.40;
}

// 방 1 충돌 체크 함수
function checkRoom1Collision(x, z) {
    // 왼쪽 벽
    if (x <= room1Boundaries.minX + wallMargin) {
        return true;
    }
    
    // 오른쪽 벽
    if (x >= room1Boundaries.maxX - wallMargin) {
        return true;
    }
    
    // 아래쪽 벽
    if (z <= room1Boundaries.minZ + wallMargin) {
        return true;
    }
    
    // 위쪽 벽 (문 구간 제외)
    if (z >= room1Boundaries.maxZ - wallMargin) {
        // 문 구간인지 확인
        const isInDoorway = (x >= room1Boundaries.doorMinX && x <= room1Boundaries.doorMaxX);
        if (!isInDoorway) {
            return true; // 문이 아닌 구간에서는 벽 충돌
        }
    }
    
    return false;
}

// 방 2 충돌 체크 함수
function checkRoom2Collision(x, z) {
    // 왼쪽 벽
    if (x <= room2Boundaries.minX + wallMargin) {
        return true;
    }
    
    // 오른쪽 벽
    if (x >= room2Boundaries.maxX - wallMargin) {
        return true;
    }
    
    // 아래쪽 벽 (문 구간 제외)
    if (z <= room2Boundaries.minZ + wallMargin) {
        // 문 구간인지 확인
        const isInDoorway = (x >= room2Boundaries.doorMinX && x <= room2Boundaries.doorMaxX);
        if (!isInDoorway) {
            return true; // 문이 아닌 구간에서는 벽 충돌
        }
    }
    
    // 위쪽 벽
    if (z >= room2Boundaries.maxZ - wallMargin) {
        return true;
    }
    
    return false;
}

// 마우스 클릭으로 에어팟 감지 함수 (최적화)
const rayDirection = new THREE.Vector3();
function checkAirpodClick() {
    if (gameCompleted || !airpodModel) return false;
    
    // 카메라 방향 벡터 가져오기
    camera.getWorldDirection(rayDirection);
    
    // Raycaster 설정
    raycaster.set(camera.position, rayDirection);
    
    // 에어팟과의 교차점 찾기
    const intersects = raycaster.intersectObject(airpodModel, true);
    
    if (intersects.length > 0) {
        // 에어팟 클릭 성공!
        completeGame();
        return true;
    }
    
    return false;
}



// 충돌 감지 함수 (최적화)
function checkCollision(x, z) {
    // 방 1 영역 내에 있을 때 방 1 벽 충돌 체크
    if (isInRoom1(x, z)) {
        return checkRoom1Collision(x, z);
    }
    
    // 방 2 영역 내에 있을 때 방 2 벽 충돌 체크
    if (isInRoom2(x, z)) {
        return checkRoom2Collision(x, z);
    }
    
    return false; // 두 방 밖에 있으면 충돌 체크 안함
}

// 움직임 처리 함수 (최적화)
function updateMovement(delta) {
    // 이동 입력이 없으면 바로 리턴
    if (!moveState.forward && !moveState.backward && !moveState.left && !moveState.right) {
        // 앉기 상태만 체크
        camera.position.y = moveState.crouching ? floorY + playerHeight * 0.5 : floorY + playerHeight;
        return;
    }

    // 속도 감쇠 (필요한 축만)
    const damping = 10.0 * delta;
    velocity.x -= velocity.x * damping;
    velocity.z -= velocity.z * damping;

    // 이동 방향 계산 (정규화 최적화)
    const forwardInput = Number(moveState.forward) - Number(moveState.backward);
    const rightInput = Number(moveState.right) - Number(moveState.left);
    
    // 대각선 이동 보정 (sqrt 계산 최소화)
    const inputLength = Math.abs(forwardInput) + Math.abs(rightInput);
    const normalizer = inputLength > 1 ? 0.7071 : 1; // sqrt(2)/2 근사치

    // 속도 업데이트
    if (forwardInput !== 0) {
        velocity.z -= forwardInput * normalizer * moveSpeed * delta;
    }
    if (rightInput !== 0) {
        velocity.x -= rightInput * normalizer * moveSpeed * delta;
    }

    // 현재 위치 저장
    const currentX = camera.position.x;
    const currentZ = camera.position.z;
    
    // 이동 적용
    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    
    // 충돌 체크 (좌표만 전달)
    if (checkCollision(camera.position.x, camera.position.z)) {
        // 충돌 시 이전 위치로 복원
        camera.position.x = currentX;
        camera.position.z = currentZ;
    }
    
    // Y 위치 설정 (앉기 상태 고려)
    camera.position.y = moveState.crouching ? floorY + playerHeight * 0.5 : floorY + playerHeight;
}

// 렌더 루프 (최적화 강화)
let lastRenderTime = 0;
function animate() {
    requestAnimationFrame(animate);
    
    const now = performance.now();
    const delta = clock.getDelta();
    
    // 프레임 제한 최적화 (8.33ms = 120fps)
    if (now - lastRenderTime < 8.33) {
        return;
    }
    lastRenderTime = now;
    
    // 움직임 업데이트 (포인터 락이 활성화된 경우에만)
    if (controls.isLocked) {
        updateMovement(delta);
    }
    
    // 렌더링
    renderer.render(scene, camera);
    stats.update();
}

// 에어팟 가능한 위치들 (최적화: 미리 계산된 값 사용)
const airpodPositions = [
    { x: -1.60, y: 2.03, z: 5.90 },
    { x: -1.96, y: 2.03, z: -5.87 },
    { x: -1.77, y: 2.03, z: 0.46 },
    { x: 10.10, y: 2.88, z: 9.35 },
    { x: 8.35, y: 2.84, z: 6.96 },
    { x: 9.84, y: 2.03, z: 13.89 },
    { x: 2.52, y: 2.03, z: 14.36 }
];

// 에어팟 로드 함수
function loadAirpod() {
    gltfLoader.load(
        './airpod.glb',
        function (gltf) {
            airpodModel = processGLBModel(gltf, 'Airpod');
            
            // 무작위 위치 선택
            const randomIndex = Math.floor(Math.random() * airpodPositions.length);
            const selectedPosition = airpodPositions[randomIndex];
            
            // 선택된 위치에 배치
            airpodModel.position.set(
                selectedPosition.x, 
                selectedPosition.y, 
                selectedPosition.z
            );
            
            // 적절한 크기로 스케일 조정
            airpodModel.scale.set(0.3, 0.3, 0.3);
            
            // 에어팟 배치 완료 (콘솔 출력 제거)
            
            scene.add(airpodModel);
        },
        function (progress) {
            // 에어팟 로딩 진행률
        },
        function (error) {
            // 에어팟 로드 실패 (콘솔 출력 제거)
        }
    );
}

// 애니메이션 시작
animate();
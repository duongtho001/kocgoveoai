import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CameraState } from '../types';
import { AZIMUTH_STEPS, ELEVATION_STEPS, DISTANCE_STEPS } from '../constants/camera360';
import { snapToNearest, buildCameraPrompt } from '../utils/camera360';

interface Camera3DProps {
  value: CameraState;
  onChange: (value: CameraState) => void;
  imageUrl?: string;
}

const Camera3D: React.FC<Camera3DProps> = ({ value, onChange, imageUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const stateRef = useRef(value);
  const updateTextureRef = useRef<(url: string | undefined) => void>(() => {});

  // Sync internal state ref with props to avoid stale closures in event listeners
  useEffect(() => {
    stateRef.current = value;
  }, [value]);

  // Update texture when imageUrl changes
  useEffect(() => {
    updateTextureRef.current(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = 450;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9); // Light slate background

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(4.5, 3, 4.5);
    camera.lookAt(0, 0.75, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    // Grid (lighter for light mode)
    scene.add(new THREE.GridHelper(8, 16, 0xcbd5e1, 0xe2e8f0));

    const CENTER = new THREE.Vector3(0, 0.75, 0);
    const BASE_DISTANCE = 1.6;
    const AZIMUTH_RADIUS = 2.4;
    const ELEVATION_RADIUS = 1.8;

    // Plane setup
    const textureLoader = new THREE.TextureLoader();
    let planeMaterial = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide });
    let targetPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), planeMaterial);
    targetPlane.position.copy(CENTER);
    scene.add(targetPlane);

    const updateTexture = (url: string | undefined) => {
      if (!url) {
        planeMaterial.color.set(0xe2e8f0);
        planeMaterial.map = null;
        planeMaterial.needsUpdate = true;
        return;
      }
      textureLoader.load(url, (texture) => {
        planeMaterial.map = texture;
        planeMaterial.color.set(0xffffff);
        planeMaterial.needsUpdate = true;
        
        const aspect = texture.image.width / texture.image.height;
        const maxSize = 1.5;
        let pW = maxSize, pH = maxSize;
        if (aspect > 1) pH = maxSize / aspect; else pW = maxSize * aspect;
        
        scene.remove(targetPlane);
        targetPlane = new THREE.Mesh(new THREE.PlaneGeometry(pW, pH), planeMaterial);
        targetPlane.position.copy(CENTER);
        scene.add(targetPlane);
      });
    };

    updateTextureRef.current = updateTexture;
    updateTexture(imageUrl);

    // Camera Model
    const cameraGroup = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.38), new THREE.MeshStandardMaterial({ color: 0x334155 })); // Darker camera body
    cameraGroup.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.18, 16), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.26;
    cameraGroup.add(lens);
    scene.add(cameraGroup);

    // Controls
    const azimuthRing = new THREE.Mesh(new THREE.TorusGeometry(AZIMUTH_RADIUS, 0.04, 16, 64), new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.1 }));
    azimuthRing.rotation.x = Math.PI / 2;
    azimuthRing.position.y = 0.05;
    scene.add(azimuthRing);

    const azimuthHandle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981 }));
    azimuthHandle.userData.type = 'azimuth';
    scene.add(azimuthHandle);

    const arcPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = THREE.MathUtils.degToRad(-90 + (180 * i / 64));
      arcPoints.push(new THREE.Vector3(-0.8, ELEVATION_RADIUS * Math.sin(angle) + CENTER.y, ELEVATION_RADIUS * Math.cos(angle)));
    }
    const arcCurve = new THREE.CatmullRomCurve3(arcPoints);
    const elevationArc = new THREE.Mesh(new THREE.TubeGeometry(arcCurve, 32, 0.04, 8, false), new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xec4899, emissiveIntensity: 0.1 }));
    scene.add(elevationArc);

    const elevationHandle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xec4899 }));
    elevationHandle.userData.type = 'elevation';
    scene.add(elevationHandle);

    const distanceHandle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b }));
    distanceHandle.userData.type = 'distance';
    scene.add(distanceHandle);

    const distanceLineGeo = new THREE.BufferGeometry();
    const distanceLine = new THREE.Line(distanceLineGeo, new THREE.LineBasicMaterial({ color: 0xf59e0b }));
    scene.add(distanceLine);

    const updatePositions = () => {
      const { azimuth, elevation, distance: distFactor } = stateRef.current;
      const distance = BASE_DISTANCE * distFactor;
      const azRad = THREE.MathUtils.degToRad(azimuth);
      const elRad = THREE.MathUtils.degToRad(elevation - 90);

      const camX = distance * Math.sin(azRad) * Math.cos(elRad);
      const camY = distance * Math.sin(elRad) + CENTER.y;
      const camZ = distance * Math.cos(azRad) * Math.cos(elRad);

      cameraGroup.position.set(camX, camY, camZ);
      cameraGroup.lookAt(CENTER);

      azimuthHandle.position.set(AZIMUTH_RADIUS * Math.sin(azRad), 0.05, AZIMUTH_RADIUS * Math.cos(azRad));
      elevationHandle.position.set(-0.8, ELEVATION_RADIUS * Math.sin(elRad) + CENTER.y, ELEVATION_RADIUS * Math.cos(elRad));
      
      const orangeDist = distance - 0.5;
      distanceHandle.position.set(
        orangeDist * Math.sin(azRad) * Math.cos(elRad),
        orangeDist * Math.sin(elRad) + CENTER.y,
        orangeDist * Math.cos(azRad) * Math.cos(elRad)
      );
      distanceLineGeo.setFromPoints([cameraGroup.position, CENTER]);
    };

    // Interaction logic
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false;
    let dragTarget: any = null;
    let dragStartMouse = new THREE.Vector2();
    let dragStartDistance = 1.0;
    const intersection = new THREE.Vector3();

    const onPointerDown = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      if (isDragging) {
        isDragging = false;
        dragTarget = null;
        return;
      }

      const intersects = raycaster.intersectObjects([azimuthHandle, elevationHandle, distanceHandle]);
      if (intersects.length > 0) {
        isDragging = true;
        dragTarget = intersects[0].object;
        dragStartMouse.copy(mouse);
        dragStartDistance = stateRef.current.distance;
      }
    };

    const onPointerMove = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      if (isDragging && dragTarget) {
        raycaster.setFromCamera(mouse, camera);
        const newState = { ...stateRef.current };
        if (dragTarget.userData.type === 'azimuth') {
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);
          if (raycaster.ray.intersectPlane(plane, intersection)) {
            let angle = THREE.MathUtils.radToDeg(Math.atan2(intersection.x, intersection.z));
            if (angle < 0) angle += 360;
            newState.azimuth = angle;
          }
        } else if (dragTarget.userData.type === 'elevation') {
          const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -0.8);
          if (raycaster.ray.intersectPlane(plane, intersection)) {
            const relY = intersection.y - CENTER.y;
            const relZ = intersection.z;
            newState.elevation = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(Math.atan2(relY, relZ)) + 90, 0, 180);
          }
        } else if (dragTarget.userData.type === 'distance') {
          const deltaY = mouse.y - dragStartMouse.y;
          newState.distance = THREE.MathUtils.clamp(dragStartDistance - deltaY * 1.5, 0.6, 2.5);
        }
        stateRef.current = newState;
        onChange(newState);
      }
    };

    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
    canvas.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
    });
    canvas.addEventListener('touchmove', (e) => {
      onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    });

    const animate = () => {
      requestAnimationFrame(animate);
      updatePositions();
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
      canvas.removeEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
      if (containerRef.current?.contains(canvas)) {
        containerRef.current.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-slate-100 shadow-inner border border-slate-200">
      <div ref={containerRef} className="w-full h-[450px]" />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 px-4 py-2 rounded-lg font-mono text-xs text-emerald-600 whitespace-nowrap z-10 border border-emerald-200 shadow-sm backdrop-blur-sm">
        <span className="font-bold mr-1">Lệnh:</span> {buildCameraPrompt(value.azimuth, value.elevation, value.distance)}
      </div>
    </div>
  );
};

export default Camera3D;

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function VoxelTreeMascot() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const treeRef = useRef<THREE.Group | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, isDragging: false });
  const rotationRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = null; // Transparent background
    sceneRef.current = scene;

    // Camera setup - adjusted for larger tree
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 1, 14);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting - enhanced for better depth
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(6, 12, 6);
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0x88bbff, 0.3);
    backLight.position.set(-4, 8, -6);
    scene.add(backLight);

    // Create voxel tree
    const tree = new THREE.Group();
    treeRef.current = tree;

    // Larger voxel size
    const voxelSize = 0.6;

    // Helper function to create a voxel block with optional emissive glow
    const createVoxel = (x: number, y: number, z: number, color: number, isShiny: boolean = false) => {
      const geometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
      const material = new THREE.MeshPhongMaterial({
        color,
        shininess: isShiny ? 100 : 30,
        emissive: isShiny ? new THREE.Color(color).multiplyScalar(0.2) : 0x000000,
      });
      const box = new THREE.Mesh(geometry, material);
      box.position.set(x * voxelSize, y * voxelSize, z * voxelSize);
      box.castShadow = true;
      box.receiveShadow = true;
      return box;
    };

    // Colors
    const trunkColor = 0x8B4513;
    const lightGreen = 0x22C55E;
    const mediumGreen = 0x16A34A;
    const darkGreen = 0x0F5F2A;
    const whiteColor = 0xFFFFFF;
    const blackColor = 0x000000;

    // Trunk - thicker and more detailed
    const trunkX = 0;
    const trunkZ = 0;
    for (let y = 0; y < 5; y++) {
      tree.add(createVoxel(trunkX, y, trunkZ, trunkColor));
    }
    // Add branches to trunk
    tree.add(createVoxel(-1, 2, 0, trunkColor));
    tree.add(createVoxel(1, 2, 0, trunkColor));
    tree.add(createVoxel(0, 3, -1, trunkColor));
    tree.add(createVoxel(0, 3, 1, trunkColor));

    // Bottom layer of foliage (largest) - expanded
    const bottomY = 5;
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        // Create a more natural octagonal/circular shape
        if (Math.abs(x) + Math.abs(z) <= 3.2) {
          const dist = Math.abs(x) + Math.abs(z);
          const color = dist >= 2.8 ? darkGreen : lightGreen;
          tree.add(createVoxel(x, bottomY, z, color));
        }
      }
    }

    // Second layer - medium size
    const middleY = 6;
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        if (Math.abs(x) + Math.abs(z) <= 2.3) {
          const color = Math.abs(x) + Math.abs(z) >= 1.8 ? mediumGreen : lightGreen;
          tree.add(createVoxel(x, middleY, z, color));
        }
      }
    }

    // Third layer - smaller
    const topMiddleY = 7;
    for (let x = -1.5; x <= 1.5; x += 1) {
      for (let z = -1.5; z <= 1.5; z += 1) {
        const xi = Math.round(x);
        const zi = Math.round(z);
        if (Math.abs(xi) + Math.abs(zi) <= 1.8) {
          tree.add(createVoxel(xi, topMiddleY, zi, mediumGreen));
        }
      }
    }

    // Top layer - even smaller
    const topY = 8;
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        if (Math.abs(x) + Math.abs(z) <= 1.2) {
          tree.add(createVoxel(x, topY, z, darkGreen));
        }
      }
    }

    // Peak of the tree
    tree.add(createVoxel(0, 9, 0, darkGreen, true));

    // Add subtle side branches
    tree.add(createVoxel(0, 6, 2, darkGreen));
    tree.add(createVoxel(2, 6, 0, darkGreen));
    tree.add(createVoxel(0, 7, -2, mediumGreen));
    tree.add(createVoxel(-2, 7, 0, mediumGreen));

    // IMPROVED FACE - positioned better on the tree
    const faceY = 5.5;
    const faceZ = -3.1; // On the front

    // Left eye white - larger
    tree.add(createVoxel(-1.2, faceY + 0.5, faceZ, whiteColor));
    // Left eye pupil - positioned better
    tree.add(createVoxel(-1.2, faceY + 0.3, faceZ - 0.3, blackColor, true));

    // Right eye white - larger
    tree.add(createVoxel(1.2, faceY + 0.5, faceZ, whiteColor));
    // Right eye pupil - positioned better
    tree.add(createVoxel(1.2, faceY + 0.3, faceZ - 0.3, blackColor, true));

    // Better smile - wider and more expressive
    tree.add(createVoxel(-0.6, faceY - 0.3, faceZ - 0.3, blackColor, true));
    tree.add(createVoxel(0, faceY - 0.6, faceZ - 0.3, blackColor, true));
    tree.add(createVoxel(0.6, faceY - 0.3, faceZ - 0.3, blackColor, true));

    // Optional nose
    tree.add(createVoxel(0, faceY, faceZ - 0.3, 0xD2B48C));

    // Rosy cheeks - positioned better
    tree.add(createVoxel(-2, faceY - 0.2, faceZ - 0.5, 0xFF9999));
    tree.add(createVoxel(2, faceY - 0.2, faceZ - 0.5, 0xFF9999));

    scene.add(tree);

    // Mouse event handlers for interactive rotation
    const onMouseDown = (event: MouseEvent) => {
      mouseRef.current.isDragging = true;
      mouseRef.current.x = event.clientX;
      mouseRef.current.y = event.clientY;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!mouseRef.current.isDragging || !treeRef.current) return;

      const deltaX = event.clientX - mouseRef.current.x;
      const deltaY = event.clientY - mouseRef.current.y;

      rotationRef.current.y += deltaX * 0.01;
      rotationRef.current.x += deltaY * 0.01;

      treeRef.current.rotation.y = rotationRef.current.y;
      treeRef.current.rotation.x = rotationRef.current.x;

      mouseRef.current.x = event.clientX;
      mouseRef.current.y = event.clientY;
    };

    const onMouseUp = () => {
      mouseRef.current.isDragging = false;
    };

    containerRef.current.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Animation loop - reduced auto rotation when not dragging
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Gentle auto-rotation only when not dragging
      if (treeRef.current && !mouseRef.current.isDragging) {
        treeRef.current.rotation.y += 0.002;
        treeRef.current.position.y = Math.sin(Date.now() * 0.0003) * 0.15;
        // Subtle sway
        treeRef.current.rotation.z = Math.sin(Date.now() * 0.0002) * 0.05;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) {
        containerRef.current.removeEventListener('mousedown', onMouseDown);
      }
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="voxel-tree-container" />;
}

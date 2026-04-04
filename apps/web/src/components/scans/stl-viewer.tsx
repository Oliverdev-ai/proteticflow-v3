import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Props = { url: string; color?: string };

export function StlViewer({ url, color = '#a78bfa' }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;
    let animationFrameId: number | null = null;

    // Cenário e câmera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#171717');

    const camera = new THREE.PerspectiveCamera(45, currentMount.clientWidth / currentMount.clientHeight, 1, 1000);
    camera.position.set(0, 0, 150);

    // Renderizador
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);

    // Controles
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Iluminação
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-1, -1, -1).normalize();
    scene.add(backLight);

    // Carregar STL
    const loader = new STLLoader();
    let mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhongMaterial> | null = null;
    
    loader.load(url, (geometry: THREE.BufferGeometry) => {
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(color),
        specular: 0x111111,
        shininess: 100,
      });

      geometry.computeVertexNormals();
      geometry.center();

      mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(1.2, 1.2, 1.2);

      // Animation inicial
      mesh.rotation.x = -Math.PI / 2;

      scene.add(mesh);
    });

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (mesh) {
        mesh.rotation.z += 0.005;
      }
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!currentMount) return;
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      currentMount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [url, color]);

  return <div ref={mountRef} className="w-full h-full min-h-[300px] rounded-2xl overflow-hidden cursor-move border border-neutral-800" />;
}

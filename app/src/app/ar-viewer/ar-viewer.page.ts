import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';

declare var AFRAME: any;

// Registrar el componente a nivel de archivo para asegurar que A-Frame lo reconozca antes de renderizar el HTML
if (typeof AFRAME !== 'undefined' && !AFRAME.components['reveal-on-lift']) {
  console.log("Registrando componente 'reveal-on-lift' de A-Frame...");
  AFRAME.registerComponent('reveal-on-lift', {
    schema: {
      liftRange: { type: 'number', default: 1.5 } // Cuántos metros debe alejarse/subirse el celular para revelar 100%
    },
    init: function () {
      console.log("Componente 'reveal-on-lift' inicializado.");
      this.imageEl = this.el;
      this.lastP = -1;
      this.initialDist = -1;
      this.lostTimeout = null;
      
      const marker = this.el.sceneEl.querySelector('a-marker');
      if (marker) {
        marker.addEventListener('markerFound', () => {
          console.log("A-Frame: ¡Marcador ENCONTRADO!");
          if (this.lostTimeout) {
            clearTimeout(this.lostTimeout);
            this.lostTimeout = null;
          }
          // Solo recalibramos si realmente se había perdido por completo
          if (this.initialDist === -1) {
            this.initialDist = -1; 
          }
        });
        marker.addEventListener('markerLost', () => {
          console.log("A-Frame: Marcador PERDIDO (esperando 2s para resetear)");
          // Guardar el estado por 2 segundos antes de resetear
          this.lostTimeout = setTimeout(() => {
            this.initialDist = -1;
            window.dispatchEvent(new CustomEvent('ar-lift-progress', { detail: 0 }));
            console.log("A-Frame: Progreso reseteado por inactividad");
          }, 2000);
        });
      }
    },
    tick: function () {
      const marker = this.el.sceneEl.querySelector('a-marker');
      if (!marker || !marker.object3D.visible) {
        this.initialDist = -1;
        return;
      }

      // Distancia de la cámara (0,0,0) al marcador
      const dist = marker.object3D.position.length();

      // Calibración automática al detectar el marcador
      if (this.initialDist === -1 || this.initialDist === 0) {
        this.initialDist = dist;
        console.log(`Calibración AR: Distancia inicial calibrada a ${dist.toFixed(2)}m`);
        return;
      }
      
      // La barra empieza a cargarse cuando el teléfono se aleja de la distancia inicial
      const minDist = this.initialDist + 0.15; // Pequeño umbral de 15cm para evitar ruido
      const maxDist = this.initialDist + this.data.liftRange; // Rango de subida

      let p = 0;
      if (dist < minDist) {
        p = 0;
      } else if (dist > maxDist) {
        p = 1;
      } else {
        p = (dist - minDist) / (maxDist - minDist);
      }

      // Consola de depuración para calibración
      console.log(`AR.js Distancia: ${dist.toFixed(2)}m (Inicial: ${this.initialDist.toFixed(2)}m) -> Progreso: ${(p * 100).toFixed(0)}%`);

      // Emitir progreso al componente de Angular solo si cambia significativamente
      if (Math.abs(this.lastP - p) > 0.02 || p === 0 || p === 1) {
         window.dispatchEvent(new CustomEvent('ar-lift-progress', { detail: p }));
         this.lastP = p;
      }

      // Aplicar opacidad a la imagen 3D
      this.imageEl.setAttribute('material', 'opacity', p);
    }
  });
} else {
  console.warn("AFRAME no está definido al cargar el archivo TS.");
}

@Component({
  selector: 'app-ar-viewer',
  templateUrl: './ar-viewer.page.html',
  styleUrls: ['./ar-viewer.page.scss'],
  standalone: false,
})
export class ArViewerPage implements OnInit, OnDestroy {

  progress: number = 0;
  isImageVisible: boolean = false;

  constructor(private ngZone: NgZone) { }

  ngOnInit() {
    console.log("Angular: ArViewerPage inicializado.");
    
    // Escuchar el evento personalizado emitido por A-Frame
    window.addEventListener('ar-lift-progress', this.onARProgress);
  }

  onARProgress = (e: any) => {
    this.ngZone.run(() => {
      this.progress = e.detail;
      this.isImageVisible = this.progress >= 1.0;
      console.log("Angular: Progreso recibido =", this.progress);
    });
  }

  ionViewWillEnter() {
    document.body.classList.add('ar-active');
  }

  ionViewWillLeave() {
    document.body.classList.remove('ar-active');
  }

  ngOnDestroy() {
    document.body.classList.remove('ar-active');
    window.removeEventListener('ar-lift-progress', this.onARProgress);
  }
}

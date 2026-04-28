# Evaluacion de Desempeno

Aplicacion offline para escritorio y navegador, pensada para que jefaturas preparen feedback anual, evalúen comportamientos en equipos de tecnologia y generen un ranking con señal de prioridad salarial.

## Stack elegido

- Electron
- React + TypeScript
- SQLite embebido con `better-sqlite3`
- IndexedDB en navegador para despliegue web
- Importacion y exportacion CSV

Se eligio Electron en lugar de Tauri porque en este entorno Node.js estaba disponible y Rust no, por lo que Electron permitia dejar un MVP ejecutable y empaquetable de inmediato.

## Lo que ya hace

- Mantiene un registro local de colaboradores
- Permite seleccionar un colaborador y completar su evaluacion anual
- Puntua atributos relevantes para trabajo en tecnologia
- Calcula un score, una banda de recomendacion y puntos de merito
- Muestra ranking del equipo con la ultima evaluacion guardada por colaborador
- Exporta el respaldo completo a CSV
- Importa CSV para restaurar datos en otro equipo o sesion
- Permite correr en GitHub Pages guardando datos localmente por navegador con IndexedDB
- Permite cerrar una evaluacion descargando un PDF de feedback para compartir por correo despues del 1:1
- Incluye firma configurable del responsable en el PDF y en los respaldos exportados
- El respaldo CSV ahora conserva tambien colaboradores sin evaluacion, cierres por período y la firma del responsable

## Criterios incluidos

- Colaboracion
- Gestion de stakeholders
- Ownership
- Ejecucion
- Calidad de software
- Respuesta a incidentes
- Disciplina operativa
- Comunicacion
- Autonomia
- Aprendizaje
- Impacto
- Potencial de crecimiento
- Readiness para aumento

## Comandos

```bash
npm install
npm run dev
npm run lint
npm run build
npm run build:pages
npx electron-builder --dir
```

## GitHub Pages

- La version web se construye con `npm run build:pages`.
- El deploy puede publicarse desde la carpeta `dist` en GitHub Pages.
- Cada usuario conserva sus datos solo en su propio navegador mediante IndexedDB.
- Si necesita mover o respaldar informacion, debe usar exportacion CSV e importarla en otro navegador o equipo.

## Salida empaquetada

En macOS, el empaquetado desempaquetado queda en `dist/mac-arm64/Evaluacion de Desempeno.app`.

## Modelo de scoring inicial

- Cada atributo se evalua en escala de 1 a 5.
- El score final se normaliza a 100 puntos usando pesos simples y legibles.
- La banda de compensacion usa tres niveles iniciales: `Prioridad alta`, `Prioridad media` y `Sin prioridad`, con un estado intermedio de observacion.

Este modelo es intencionalmente simple para que una jefatura pueda explicar el resultado. Se puede calibrar despues segun politica interna y presupuesto anual distribuible.

## Siguientes mejoras recomendadas

1. Separar perfiles por jefatura o area.
2. Agregar historico por año con comparacion entre periodos.
3. Definir una politica de distribucion presupuestaria basada en puntos de merito.
4. Agregar icono de aplicacion y firma para distribucion formal.
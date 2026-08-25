import React from 'react';
import { Gamepad2 } from 'lucide-react';

export const Footer: React.FC = () => (
  <footer className="border-t border-line bg-surface">
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-12 lg:flex-row lg:items-start lg:justify-between lg:px-8">
      <div className="max-w-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 text-accent">
            <Gamepad2 size={18} />
          </span>
          <span className="font-display text-lg font-bold text-white">ClassArcade</span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Arcade multijugador para el aula. Juegos por equipos que se proyectan
          en clase y se juegan desde el celular, sin instalaciones.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[1.5px] text-muted">
            Juegos
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>CodeImpostor</li>
            <li>Tira y Afloja</li>
            <li>Papa Caliente</li>
            <li>DrawDash</li>
            <li>Trivia Royale</li>
            <li>SwipeRight</li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[1.5px] text-muted">
            Cómo funciona
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Conectarse a la red local</li>
            <li>Escanea el QR del proyector</li>
            <li>Juega sin descargas</li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[1.5px] text-muted">
            Proyecto
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Administración de Proyectos</li>
            <li>Proyecto personal 2026</li>
          </ul>
        </div>
      </div>
    </div>

    <div className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <p>© 2026 ClassArcade. Hecho para jugar en clase.</p>
        <p>Cada quien entra desde su celular en la red del aula.</p>
      </div>
    </div>
  </footer>
);

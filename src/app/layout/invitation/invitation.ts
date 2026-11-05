import { Component, ElementRef, OnDestroy, afterNextRender, computed, signal, viewChild } from '@angular/core';
import { INVITE } from '../../invitation.config';
import type { ConvergenceScene } from '../../convergence.scene';

type Phase = 'ready' | 'opening' | 'reveal' | 'exploring';

@Component({
  imports: [],
  selector: 'app-invitation',
  styleUrl: './invitation.css',
  templateUrl: './invitation.html',
})
export class Invitation implements OnDestroy {
  protected readonly invite = INVITE;
  protected readonly petals = [0, 45, 90, 135, 180, 225, 270, 315];
  protected readonly phase = signal<Phase>('ready'); // one explicit state, never loose booleans
  protected readonly guest = signal('');
  protected readonly left = signal({ days: 0, hours: 0, mins: 0, secs: 0 });
  private readonly stage = viewChild.required<ElementRef<HTMLCanvasElement>>('stage');
  private scene?: ConvergenceScene;
  private timer?: number;
  private readonly target = new Date(INVITE.dateIso).getTime();

  protected readonly mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(INVITE.mapQuery);
  protected readonly rsvp = computed(() => (attending: boolean) => {
    const who = this.guest().trim() || 'A guest';
    const text = `${who} ${attending ? 'will joyfully attend' : 'regretfully declines'} the ${INVITE.occasion} of ${INVITE.groom} & ${INVITE.bride}.`;
    return `https://wa.me/${INVITE.whatsapp}?text=${encodeURIComponent(text)}`;
  });

  constructor() {
    // afterNextRender only runs in the browser, so this is safe with SSR enabled.
    afterNextRender(async () => {
      this.tick();
      this.timer = window.setInterval(() => this.tick(), 1000);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; // no 3D: invitation only
      try {
        const m = await import('../../convergence.scene'); // Three.js + GSAP load lazily
        this.scene = new m.ConvergenceScene(this.stage().nativeElement);
      } catch { /* no WebGL: the invitation still works */ }
    });
  }

  protected begin() {
    if (this.phase() !== 'ready') return; // ignores repeat taps while the animation runs
    this.phase.set('opening');
    if (this.scene) this.scene.play(() => this.reveal()); else this.reveal();
  }

  protected skip() { this.scene?.stop(); this.reveal(); }

  private reveal() {
    if (this.phase() === 'reveal' || this.phase() === 'exploring') return;
    this.phase.set('reveal');
    setTimeout(() => this.phase.set('exploring'), 2000);
  }

  private tick() {
    const d = Math.max(0, this.target - Date.now());
    this.left.set({
      days: Math.floor(d / 864e5), hours: Math.floor(d / 36e5) % 24,
      mins: Math.floor(d / 6e4) % 60, secs: Math.floor(d / 1e3) % 60,
    });
  }

  protected calendarHref() {
    const f = (t: number) => new Date(t).toISOString().replace(/[-:]|\.\d{3}/g, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
      `DTSTART:${f(this.target)}`, `DTEND:${f(this.target + 4 * 36e5)}`,
      `SUMMARY:${INVITE.occasion}: ${INVITE.groom} & ${INVITE.bride}`,
      `LOCATION:${INVITE.address}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  }

  protected pad = (n: number) => String(n).padStart(2, '0');

  ngOnDestroy() { clearInterval(this.timer); this.scene?.dispose(); }

}

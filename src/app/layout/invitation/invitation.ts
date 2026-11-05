import { Component, ElementRef, OnDestroy, afterNextRender, HostListener,computed, signal, viewChild } from '@angular/core';
import { INVITE, type GalleryImage } from '../../invitation.config';
import type { ConvergenceScene } from '../../convergence.scene';

type Phase = 'ready' | 'opening' | 'reveal' | 'exploring';

interface Countdown {
  days: number;
  hours: number;
  mins: number;
  secs: number;
}

@Component({
  imports: [],
  selector: 'app-invitation',
  styleUrl: './invitation.css',
  templateUrl: './invitation.html',
})
export class Invitation implements OnDestroy {
  protected readonly invite = INVITE;
  protected readonly phase = signal<Phase>('ready');
  protected readonly sceneReady = signal(false);
  protected readonly guest = signal('');
  protected readonly guestCount = signal(1);
  protected readonly guestError = signal('');
  protected readonly left = signal<Countdown>({ days: 0, hours: 0, mins: 0, secs: 0 });
  protected readonly activePhoto = signal<GalleryImage | null>(null);

  private readonly stage = viewChild.required<ElementRef<HTMLCanvasElement>>('stage');
  private readonly page = viewChild<ElementRef<HTMLElement>>('page');
  private readonly target = new Date(INVITE.dateIso).getTime();
  private scene?: ConvergenceScene;
  private timer?: number;
  private revealTimer?: number;
  private destroyed = false;

  protected readonly mapUrl =
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(INVITE.mapQuery);

  protected readonly daysLabel = computed(() => {
    const { days, hours, mins, secs } = this.left();
    return `${days} days, ${hours} hours, ${mins} minutes and ${secs} seconds`;
  });

  constructor() {
    // Three.js touches browser APIs, so it is imported only after Angular renders in the browser.
    afterNextRender(async () => {
      this.tick();
      this.timer = window.setInterval(() => this.tick(), 1000);

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.sceneReady.set(true);
        return;
      }

      try {
        const { ConvergenceScene } = await import('../../convergence.scene');
        if (this.destroyed) return;
        this.scene = new ConvergenceScene(this.stage().nativeElement);
      } catch (error) {
        // The invitation remains fully usable when WebGL is unsupported or unavailable.
        console.warn('[Invitation] 3D scene unavailable; using the HTML experience.', error);
      } finally {
        if (!this.destroyed) this.sceneReady.set(true);
      }
    });
  }

  protected begin(): void {
    if (this.phase() !== 'ready') return;

    this.phase.set('opening');
    if (this.scene) {
      this.scene.play(() => this.reveal());
    } else {
      // Reduced-motion and WebGL fallback: do not trap the guest behind a missing scene.
      this.reveal();
    }
  }

  protected skip(): void {
    if (this.phase() === 'reveal' || this.phase() === 'exploring') return;
    this.scene?.stop();
    this.reveal();
  }

  private reveal(): void {
    if (this.phase() === 'reveal' || this.phase() === 'exploring') return;

    this.phase.set('reveal');
    this.revealTimer = window.setTimeout(() => {
      this.phase.set('exploring');
      // The page is created by @if above; bind the scroll choreography after the next paint.
      window.setTimeout(() => {
        const pageElement = this.page()?.nativeElement;
        if (pageElement && !this.destroyed) this.scene?.bindScroll(pageElement);
      }, 80);
    }, 650);
  }

  private tick(): void {
    const remaining = Math.max(0, this.target - Date.now());
    this.left.set({
      days: Math.floor(remaining / 86_400_000),
      hours: Math.floor(remaining / 3_600_000) % 24,
      mins: Math.floor(remaining / 60_000) % 60,
      secs: Math.floor(remaining / 1_000) % 60,
    });
  }

  protected pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  protected changeGuestCount(delta: number): void {
    this.guestCount.update((current) => Math.max(1, Math.min(20, current + delta)));
  }

  protected updateGuest(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.guest.set(input.value);
    if (input.value.trim()) this.guestError.set('');
  }

  protected sendRsvp(attending: boolean): void {
    const name = this.guest().trim();
    if (!name) {
      this.guestError.set('Please enter your full name before replying.');
      document.getElementById('guest-name')?.focus();
      return;
    }

    if (!/^\d{8,15}$/.test(INVITE.whatsapp)) {
      this.guestError.set('The WhatsApp number has not been configured yet.');
      return;
    }

    const response = attending ? 'Joyfully accepts' : 'Regretfully declines';
    const message = [
      `${INVITE.occasion} — ${INVITE.dateLabel}`,
      '',
      `Guest: ${name}`,
      `Number attending: ${attending ? this.guestCount() : 0}`,
      `Response: ${response}`,
    ].join('\n');

    const url = `https://wa.me/${INVITE.whatsapp}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected calendarHref(): string {
    const start = new Date(this.target);
    const end = new Date(this.target + 4 * 60 * 60 * 1000);
    const formatUtc = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const escapeIcs = (value: string) => value
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Brett Wedding//The Convergence//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${encodeURIComponent(`${INVITE.groom}-${INVITE.bride}-${this.target}`)}@brett-wedding`,
      `DTSTAMP:${formatUtc(new Date())}`,
      `DTSTART:${formatUtc(start)}`,
      `DTEND:${formatUtc(end)}`,
      `SUMMARY:${escapeIcs(`${INVITE.occasion}: ${INVITE.groom} & ${INVITE.bride}`)}`,
      `LOCATION:${escapeIcs(INVITE.address)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];

    return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
  }

  protected openPhoto(photo: GalleryImage): void {
    this.activePhoto.set(photo);
  }

  protected closePhoto(): void {
    this.activePhoto.set(null);
  }

  protected imageFailed(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    image.closest('[data-image-frame]')?.classList.add('is-fallback');
  }

  protected imageLoaded(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    image.closest('[data-image-frame]')?.classList.remove('is-fallback');
  }

  protected stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  @HostListener('document:keydown.escape')
  protected handleEscape(): void {
    if (this.activePhoto()) this.closePhoto();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.timer !== undefined) window.clearInterval(this.timer);
    if (this.revealTimer !== undefined) window.clearTimeout(this.revealTimer);
    this.scene?.dispose();
  }
}

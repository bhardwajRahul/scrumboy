// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { destroyBurndownChart, mountBurndownChart, renderRealBurndownChart } from './burndown.js';

type BurndownSprint = {
  name: string;
  plannedStartAt: number;
  plannedEndAt: number;
};

type UPlotCall = {
  opts: any;
  data: any;
  targ: HTMLElement;
};

const uplotCalls: UPlotCall[] = [];

function installFakeUPlot(): void {
  (window as Window & { uPlot?: any }).uPlot = function FakeUPlot(this: any, opts: any, data: any, targ: HTMLElement) {
    uplotCalls.push({ opts, data, targ });
    this.destroy = vi.fn();
    this.setSize = vi.fn();
  };
}

function mountMarkup(
  data: any[],
  sprint: BurndownSprint,
  dataIsSprintScoped = true
): HTMLElement {
  document.body.innerHTML = renderRealBurndownChart(data, sprint, { canPrev: false, canNext: false }, dataIsSprintScoped);
  const mount = document.getElementById('burndown-uplot-mount');
  if (!(mount instanceof HTMLElement)) {
    throw new Error('missing burndown mount');
  }
  return mount;
}

describe('charts/burndown', () => {
  beforeEach(() => {
    uplotCalls.length = 0;
    installFakeUPlot();
    vi.stubGlobal('requestAnimationFrame', ((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    }) as typeof requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.documentElement.style.setProperty('--border', '#d9d9d9');
    document.documentElement.style.setProperty('--text', '#111111');
    document.documentElement.style.setProperty('--muted', '#666666');
    document.documentElement.style.setProperty('--accent', '#0066cc');
  });

  afterEach(() => {
    destroyBurndownChart();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (window as Window & { uPlot?: any }).uPlot;
  });

  it('shows an explicit fallback instead of mounting a one-sample sprint burndown chart', () => {
    const sprint: BurndownSprint = {
      name: 'Sprint 1',
      plannedStartAt: Date.parse('2026-04-13T12:00:00Z'),
      plannedEndAt: Date.parse('2026-04-20T12:00:00Z'),
    };
    const data = [
      { date: '2026-04-13T00:00:00Z', remainingWork: 5, initialScope: 5 },
    ];

    const mount = mountMarkup(data, sprint);
    mountBurndownChart(mount, data, sprint, true);

    expect(uplotCalls).toHaveLength(0);
    expect(mount.textContent ?? '').toContain('Not enough burndown history yet');
  });

  it('shows the same one-sample fallback when sprint start is already at UTC midnight', () => {
    const sprint: BurndownSprint = {
      name: 'Sprint 1',
      plannedStartAt: Date.parse('2026-04-13T00:00:00Z'),
      plannedEndAt: Date.parse('2026-04-20T00:00:00Z'),
    };
    const data = [
      { date: '2026-04-13T00:00:00Z', remainingWork: 5, initialScope: 5 },
    ];

    const mount = mountMarkup(data, sprint);
    mountBurndownChart(mount, data, sprint, true);

    expect(uplotCalls).toHaveLength(0);
    expect(mount.textContent ?? '').toContain('Not enough burndown history yet');
  });

  it('uses UTC day-boundary X slots for multi-day sprint burndown data', () => {
    const sprint: BurndownSprint = {
      name: 'Sprint 1',
      plannedStartAt: Date.parse('2026-04-13T12:00:00Z'),
      plannedEndAt: Date.parse('2026-04-20T12:00:00Z'),
    };
    const data = [
      { date: '2026-04-13T00:00:00Z', remainingWork: 8, initialScope: 8 },
      { date: '2026-04-14T00:00:00Z', remainingWork: 5, initialScope: 8 },
      { date: '2026-04-15T00:00:00Z', remainingWork: 2, initialScope: 8 },
    ];

    const mount = mountMarkup(data, sprint);
    mountBurndownChart(mount, data, sprint, true);

    expect(uplotCalls).toHaveLength(1);
    const xValues = uplotCalls[0].data[0] as number[];
    expect(xValues.every((sec) => sec % 86400 === 0)).toBe(true);
    expect(xValues[xValues.length - 1]).toBe(Date.parse('2026-04-21T00:00:00Z') / 1000);
    expect(uplotCalls[0].data[1].filter((value: number | null) => value != null)).toEqual([8, 5, 2]);
    expect(uplotCalls[0].data[2][uplotCalls[0].data[2].length - 1]).toBe(0);
    expect(document.querySelector('.burndown-chart__subtitle')?.textContent ?? '').toContain('Apr 13 - Apr 20');
    expect(uplotCalls[0].opts.axes[0].values(null, [xValues[0], xValues[xValues.length - 1]])).toEqual(['Apr 13', 'Apr 21']);
  });

  it('preserves render-created fallback markup when there is no meaningful plot', () => {
    const sprint: BurndownSprint = {
      name: 'Sprint 1',
      plannedStartAt: Date.parse('2026-04-13T12:00:00Z'),
      plannedEndAt: Date.parse('2026-04-20T12:00:00Z'),
    };
    const data = [
      { date: '2026-04-13T00:00:00Z', initialScope: 5 },
    ];

    const mount = mountMarkup(data, sprint);
    expect(mount.textContent ?? '').toContain('No usable burndown data available.');

    mountBurndownChart(mount, data, sprint, true);

    expect(uplotCalls).toHaveLength(0);
    expect(mount.textContent ?? '').toContain('No usable burndown data available.');
  });

  it('treats zero remaining values as valid visible samples in a multi-point series', () => {
    const sprint: BurndownSprint = {
      name: 'Sprint 1',
      plannedStartAt: Date.parse('2026-04-13T12:00:00Z'),
      plannedEndAt: Date.parse('2026-04-20T12:00:00Z'),
    };
    const data = [
      { date: '2026-04-13T00:00:00Z', remainingWork: 3, initialScope: 3 },
      { date: '2026-04-14T00:00:00Z', remainingWork: 1, initialScope: 3 },
      { date: '2026-04-15T00:00:00Z', remainingWork: 0, initialScope: 3 },
    ];

    const mount = mountMarkup(data, sprint);
    mountBurndownChart(mount, data, sprint, true);

    expect(uplotCalls).toHaveLength(1);
    expect(uplotCalls[0].data[1].filter((value: number | null) => value != null)).toEqual([3, 1, 0]);
  });
});

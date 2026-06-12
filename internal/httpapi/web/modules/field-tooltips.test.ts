// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BULK_EDIT_TOOLTIPS,
  FIELD_TOOLTIPS,
  TODO_DIALOG_TOOLTIPS,
  applyFieldTooltips,
  fieldLabelHTML,
  titleAttr,
} from './field-tooltips.js';
import {
  hydrateI18n,
  initI18n,
  resetI18nForTests,
  setLocale,
} from './i18n/index.js';

const estimationTooltip =
  'Relative effort, not hours. Uses a modified Fibonacci scale (1\u201340). Compare to similar work on this board.';
const pseudoEstimationTooltip = `[!! ${estimationTooltip} !!]`;

const enCatalog = {
  'tooltips.estimationPoints': estimationTooltip,
};

const pseudoCatalog = {
  'tooltips.estimationPoints': pseudoEstimationTooltip,
};

describe('field-tooltips', () => {
  beforeEach(async () => {
    await initI18n({
      locale: 'en',
      loadLocale: async (locale: 'en' | 'de' | 'pseudo') => (locale === 'pseudo' ? pseudoCatalog : enCatalog),
    });
  });

  afterEach(() => {
    resetI18nForTests();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('escapes HTML in titleAttr', () => {
    expect(titleAttr('Say "hello" & <goodbye>')).toBe(
      ' title="Say &quot;hello&quot; &amp; &lt;goodbye&gt;"',
    );
  });

  it('escapes HTML in fieldLabelHTML', () => {
    expect(fieldLabelHTML('Estimation <Points>', 'Tip & "note"')).toBe(
      '<div class="field__label" title="Tip &amp; &quot;note&quot;">Estimation &lt;Points&gt;</div>',
    );
  });

  it('resolves FIELD_TOOLTIPS through the active locale at read time', async () => {
    expect(FIELD_TOOLTIPS.estimationPoints).toBe(estimationTooltip);

    await setLocale('pseudo');

    expect(FIELD_TOOLTIPS.estimationPoints).toBe(pseudoEstimationTooltip);
  });

  it('applyFieldTooltips sets catalog-backed titles that hydration can rerender', async () => {
    document.body.innerHTML = `
      <div id="tip-target"></div>
    `;
    applyFieldTooltips({ '#tip-target': 'estimationPoints' });
    const el = document.getElementById('tip-target');
    expect(el?.getAttribute('title')).toBe(estimationTooltip);
    expect(el?.getAttribute('data-i18n-title')).toBe('tooltips.estimationPoints');

    await setLocale('pseudo');
    hydrateI18n(document.body);

    expect(el?.getAttribute('title')).toBe(pseudoEstimationTooltip);
  });

  it('keeps exported grouped tooltip mappings reactive after locale changes', async () => {
    document.body.innerHTML = `
      <div id="todo-tooltip"></div>
      <div id="bulk-tooltip"></div>
    `;
    applyFieldTooltips({
      '#todo-tooltip': TODO_DIALOG_TOOLTIPS['#todoEstimationField .field__label'],
      '#bulk-tooltip': BULK_EDIT_TOOLTIPS['#bulkEstimation'],
    });
    const todoEl = document.getElementById('todo-tooltip');
    const bulkEl = document.getElementById('bulk-tooltip');
    expect(todoEl?.getAttribute('title')).toBe(estimationTooltip);
    expect(bulkEl?.getAttribute('title')).toBe(estimationTooltip);

    await setLocale('pseudo');
    hydrateI18n(document.body);

    expect(todoEl?.getAttribute('title')).toBe(pseudoEstimationTooltip);
    expect(bulkEl?.getAttribute('title')).toBe(pseudoEstimationTooltip);
  });

  it('applyFieldTooltips accepts raw string tips', () => {
    document.body.innerHTML = `<div id="tip-target"></div>`;
    applyFieldTooltips({ '#tip-target': 'Custom tip text' });
    const el = document.getElementById('tip-target');
    expect(el?.getAttribute('title')).toBe('Custom tip text');
    expect(el?.hasAttribute('data-i18n-title')).toBe(false);
  });
});

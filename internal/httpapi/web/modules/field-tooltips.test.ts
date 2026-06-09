// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  FIELD_TOOLTIPS,
  applyFieldTooltips,
  fieldLabelHTML,
  titleAttr,
} from './field-tooltips.js';

describe('field-tooltips', () => {
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

  it('applyFieldTooltips sets title from FIELD_TOOLTIPS keys', () => {
    document.body.innerHTML = `
      <div id="tip-target"></div>
    `;
    applyFieldTooltips({ '#tip-target': 'estimationPoints' });
    const el = document.getElementById('tip-target');
    expect(el?.getAttribute('title')).toBe(FIELD_TOOLTIPS.estimationPoints);
  });

  it('applyFieldTooltips accepts raw string tips', () => {
    document.body.innerHTML = `<div id="tip-target"></div>`;
    applyFieldTooltips({ '#tip-target': 'Custom tip text' });
    expect(document.getElementById('tip-target')?.getAttribute('title')).toBe('Custom tip text');
  });
});

/* No data requests or persistence. The input is ephemeral page context only. */
(() => {
  const origin = document.querySelector('#origin');
  const detail = document.querySelector('#detail');
  const panel = detail.querySelector('.detail-panel');
  const transparency = document.querySelector('#transparency');
  const status = document.querySelector('#material-status');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const rootStyle = getComputedStyle(document.documentElement);
  let savedScroll = { x: 0, y: 0 };
  let animation = null;
  let closing = false;

  const duration = (name) => {
    const value = rootStyle.getPropertyValue(name).trim();
    return value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000;
  };
  const supportsBlur = CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
  transparency.hidden = false;
  status.textContent = supportsBlur
    ? '已启用选择性 Acrylic；可切换到不透明回退。'
    : '浏览器不支持背景模糊，已自动使用不透明背景。';
  transparency.addEventListener('click', () => {
    const off = transparency.getAttribute('aria-pressed') !== 'true';
    document.documentElement.dataset.dnTransparency = off ? 'off' : 'auto';
    transparency.setAttribute('aria-pressed', String(off));
    transparency.textContent = off ? '恢复 Acrylic 透明效果' : '关闭 Acrylic 透明效果';
    status.textContent = off ? '不透明回退已开启：内容保持可读。' : (supportsBlur
      ? '选择性 Acrylic 已恢复；系统减少透明偏好仍优先。'
      : '浏览器不支持背景模糊，继续使用不透明背景。');
  });

  function originTransform() {
    const from = origin.getBoundingClientRect();
    const to = panel.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    return `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  }

  function move(returning) {
    if (reducedMotion.matches || typeof panel.animate !== 'function') return null;
    const transform = originTransform();
    return panel.animate(returning
      ? [{ transform: 'none', opacity: 1 }, { transform, opacity: 0 }]
      : [{ transform, opacity: 0.35 }, { transform: 'none', opacity: 1 }], {
      duration: duration('--dn-duration-expand'),
      easing: rootStyle.getPropertyValue(returning ? '--dn-ease-out' : '--dn-ease-in').trim()
    });
  }

  origin.addEventListener('click', (event) => {
    // Older browsers and no-JS use the ordinary in-page explanation link.
    if (typeof detail.showModal !== 'function') return;
    event.preventDefault();
    if (detail.open || closing) return;
    savedScroll = { x: window.scrollX, y: window.scrollY };
    detail.showModal();
    document.body.classList.add('detail-open');
    // Default fill is none: completed animations leave no stored transforms.
    animation = move(false);
    if (animation) {
      const current = animation;
      current.finished.catch(() => {}).finally(() => {
        if (animation === current) animation = null;
      });
    }
  });

  async function close() {
    if (!detail.open || closing) return;
    closing = true;
    if (animation) animation.cancel();
    animation = move(true);
    // No dependence on CSS animationend. Unsupported/reduced-motion closes immediately.
    if (animation) await animation.finished.catch(() => {});
    animation = null;
    detail.close();
  }

  detail.addEventListener('close', () => {
    if (animation) animation.cancel();
    animation = null;
    document.body.classList.remove('detail-open');
    window.scrollTo(savedScroll.x, savedScroll.y);
    origin.focus({ preventScroll: true });
    closing = false;
  });
  detail.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  detail.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...detail.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]')]
      .filter((element) => element.tabIndex >= 0 && element.getClientRects().length);
    if (!focusable.length) { event.preventDefault(); return; }
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
  document.querySelector('#close-detail').addEventListener('click', close);
  document.querySelector('#return-detail').addEventListener('click', close);
  detail.addEventListener('click', (event) => {
    if (event.target !== detail) return;
    const rect = panel.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && animation) animation.cancel();
  });
})();

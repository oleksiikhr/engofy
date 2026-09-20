// The reader's read state for a signed-in visitor: the "Mark as read / Mark as
// unread" toggle, plus an automatic mark once the visitor has actually
// scrolled down to the final screen. Study mode's Finish marks through the
// returned `mark`. A manual toggle in either direction ends the automatic
// mark, so it never overrides the visitor's choice.

export interface ReadState {
  mark(): void;
}

const AUTO_REACH = 0.8;

export function initReadState(
  root: HTMLElement,
  final: HTMLElement,
  slugId: string,
  initiallyRead: boolean,
): ReadState {
  const toggle = root.querySelector<HTMLButtonElement>('[data-read-toggle]');
  const badge = root.querySelector<HTMLElement>('[data-read-badge]');
  let read = initiallyRead;
  let auto = !initiallyRead;
  let pending = false;

  const render = () => {
    root.dataset.read = String(read);
    if (badge) {
      badge.hidden = !read;
    }
    if (toggle) {
      toggle.textContent = read ? 'Mark as unread' : 'Mark as read';
    }
  };

  const send = async (path: string): Promise<boolean> => {
    const body = new FormData();
    body.set('slugId', slugId);
    try {
      const res = await fetch(path, { method: 'POST', body, keepalive: true });
      return res.ok;
    } catch {
      return false;
    }
  };

  // Optimistic: flips the UI first and puts it back if the request fails.
  const set = async (next: boolean) => {
    if (pending || read === next) {
      return;
    }
    pending = true;
    read = next;
    render();
    const ok = await send(
      next ? '/partials/mark-read' : '/partials/unmark-read',
    );
    if (!ok) {
      read = !next;
      render();
    }
    pending = false;
  };

  const onScroll = () => {
    if (!auto) {
      window.removeEventListener('scroll', onScroll);
      return;
    }
    if (final.getBoundingClientRect().top < window.innerHeight * AUTO_REACH) {
      window.removeEventListener('scroll', onScroll);
      void set(true);
    }
  };
  if (auto) {
    // A scroll event is the trigger, not layout: a short post whose final
    // screen is on the first paint stays unread until the visitor acts.
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  toggle?.addEventListener('click', () => {
    auto = false;
    void set(!read);
  });

  render();
  return { mark: () => void set(true) };
}

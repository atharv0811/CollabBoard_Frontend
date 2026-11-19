/**
 * Navigation for code that lives outside React components (e.g. axios interceptors).
 * The app router registers itself here; components should use `useNavigate` / `<Link>` instead.
 */
export interface NavigateOptions {
  replace?: boolean;
}

type Navigator = (to: string, options?: NavigateOptions) => unknown;

let navigator: Navigator = (to, options) => {
  if (options?.replace) window.location.replace(to);
  else window.location.assign(to);
};

export function setNavigator(next: Navigator) {
  navigator = next;
}

export function navigateTo(to: string, options?: NavigateOptions) {
  return navigator(to, options);
}

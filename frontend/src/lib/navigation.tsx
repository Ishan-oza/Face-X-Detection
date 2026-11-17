import { forwardRef } from 'react';
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
  useResolvedPath,
  type LinkProps,
  type NavigateOptions,
  type NavLinkProps,
  type To,
} from 'react-router-dom';

/*
 * Page transitions use the browser's View Transitions API through React
 * Router's `viewTransition` option. They only run when the destination is a
 * different page; same-page hash links scroll instead (see Layout). Browsers
 * without support simply navigate.
 */

function useIsOtherPage(to: To) {
  const { pathname } = useLocation();
  return useResolvedPath(to).pathname !== pathname;
}

export const PageLink = forwardRef<HTMLAnchorElement, LinkProps>(function PageLink(props, ref) {
  const otherPage = useIsOtherPage(props.to);
  return <Link ref={ref} viewTransition={otherPage} {...props} />;
});

export const PageNavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function PageNavLink(props, ref) {
  const otherPage = useIsOtherPage(props.to);
  return <NavLink ref={ref} viewTransition={otherPage} {...props} />;
});

export function usePageNavigate() {
  const navigate = useNavigate();
  return (to: To, options?: NavigateOptions) => navigate(to, { viewTransition: true, ...options });
}

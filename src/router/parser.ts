import { IRouterConfig, IRouterState } from "./interfaces";

export function splitPath(path: string): {path: string, param?: string, value?: string}[] {
    path = decodeURIComponent((path || '').trim());
    const tokens = [];
    if (path.indexOf('/') === 0) {
        path = path.substring(1).trim();
    }
    // 截掉search
    const index = path.indexOf('?');
    if (index !== -1) {
        path = path.substring(0, index);
    }
    path.split('/').forEach(p => {
        p = p.trim();
        if (p.indexOf(':') === 0) {
            const paramName = p.substring(1).trim();
            if (paramName) {
                tokens.push({
                    path: p,
                    param: paramName,
                });
            } else {
                tokens.push({path: ''});
            }
        } else {
            tokens.push({path: p});
        }
    })
    return tokens;
}

export function joinPath(parent: string, path: string) {
    parent = parent || '';
    path = path || '';
    if (parent.charAt(parent.length - 1) === '/') {
        parent = parent.substring(0, parent.length - 1);
    }
    if (path.charAt(0) !== '/') {
        path = '/' + path;
    }
    path = parent + path;
    if (path.charAt(0) !== '/') {
        path = '/' + path;
    }
    return path;
}

function parseRedirect(redirectTo, parentPath) {
    redirectTo = (redirectTo || '').trim();
    if (!redirectTo) return null;
    if (redirectTo.charAt(0) === '/') {
        return redirectTo;
    } else {
        return joinPath(parentPath || '', redirectTo);
    }
}

function isRedirectToRoot(redirectTo) {
    redirectTo = (redirectTo || '').trim();
    if (!redirectTo) return null;
    if (redirectTo.charAt(0) === '/') {
        return true;
    } else {
        return false;
    }
}

function parseConfigs(configs: IRouterConfig[], parentState?: IRouterState): IRouterState[] {
    const states = [];
    if (configs && configs.length) {
        configs.forEach(config => {
            const path = joinPath(parentState ? parentState.path : '', config.path);
            const pathStack = splitPath(path);
            const state: IRouterState = {
                path: path,
                pathStack: pathStack,
                isRedirectToRoot: isRedirectToRoot(config.redirectTo),
                redirectTo: parseRedirect(config.redirectTo, parentState ? parentState.path : ''),
                parent: parentState,
                routerGuard: (config.routerGuard || []).map(routerGuardClass => new routerGuardClass()),
                component: config.component,
                config: config,
            }
            const children = parseConfigs(config.children, state)
            children && children.length && (state.children = children)
            states.push(state);
        })
    }
    return states;
}

export function parseToRouterStates(configs: IRouterConfig[]): IRouterState[] {
    return parseConfigs(configs);
}
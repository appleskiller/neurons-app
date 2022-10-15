import { IRouterState } from "./interfaces";
import { joinPath } from "./parser";


export function isArray(obj: any): boolean {
    return obj && Object.prototype.toString.call(obj) === '[object Array]';
}

export function searchString2Params(searchString: string): any {
    searchString = (searchString || '').trim();
    if (searchString.charAt(0) === '?' || searchString.charAt(0) === '&') {
        searchString = searchString.substring(1).trim();
    }
    if (searchString.charAt(searchString.length) === '/') {
        searchString = searchString.substring(0, searchString.length - 1).trim();
    }
    const result = {};
    searchString.split('&').forEach((param: string) => {
        if (!param) return;
        const eqIdx = param.indexOf('=');
        const key = decodeURIComponent(param.slice(0, eqIdx));
        const value = decodeURIComponent(param.slice(eqIdx + 1));
        if (!result[key]) {
            result[key] = value;
        } else {
            if (!isArray(result[key])) {
                result[key] = [result[key]];
            }
            result[key].push(value);
        }
    });
    return result;
}

export function splitPath(path: string): string[] {
    path = decodeURIComponent((path || '').trim());
    const stack = [];
    if (path.indexOf('/') === 0) {
        path = path.substring(1).trim();
    }
    if (path.indexOf('#') === 0) {
        path = path.substring(1).trim();
    }
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
        stack.push(p);
    })
    return stack;
}

export function path2SearchAttrs(path: string): any {
    path = decodeURIComponent((path || '').trim());
    const hashIndex = path.indexOf('#');
    let searchIndex = -1;
    let searchString = '';
    if (hashIndex !== -1) {
        searchString = path.substring(0, hashIndex).trim();
        searchIndex = searchString.indexOf('?');
        if (searchIndex !== -1) {
            searchString = searchString.substring(searchIndex);
        } else {
            searchString = '';
        }
    }
    let hashSearchString = hashIndex === -1 ? path : path.substring(hashIndex).trim();
    const hashSearchindex = hashSearchString.indexOf('?');
    if (hashSearchindex !== -1) {
        hashSearchString = hashSearchString.substring(hashSearchindex);
    } else {
        hashSearchString = '';
    }
    const searchs = searchString2Params(searchString);
    const hashSearchs = searchString2Params(hashSearchString);
    const result = {};
    [searchs, hashSearchs].forEach(obj => {
        Object.keys(obj).forEach(key => {
            if (!result[key]) {
                result[key] = obj[key];
            } else {
                if (!isArray(result[key])) {
                    result[key] = [result[key]];
                }
                if (isArray(obj[key])) {
                    result[key] = result[key].concat(obj[key]);
                } else {
                    result[key].push(obj[key]);
                }
            }
        });
    });
    return result;
}

function matchPathParams(stack: string[], pathStack: { path: string; param?: string; }[]) {
    const params = [];
    for (let i = 0; i < stack.length; i++) {
        const p = stack[i];
        const info = pathStack[i];
        if (!info) return false;
        if (!!info.param) {
            params.push({param: info.param, value: p});
        } else {
            if (info.path === '**') {
                // 通配路由
                break;
            }
            if (info.path === '*') {
                // 任意路由节点
                continue;
            }
            if (p !== info.path) {
                return false;
            } 
        }
    }
    return params;
}

function findWithRedirectState(redirectTo: string, stack: IRouterState[]) {
    const state = stack.find(state => state.path === redirectTo);
    if (state.redirectTo) return findWithRedirectState(state.redirectTo, stack);
    return state;
}

export function matchPath(path: string, routes: IRouterState[]): {state: IRouterState; params: {param: string, value: string}[], redirected: boolean, redirectUrl: string} {
    if (!routes || !routes.length) return null;
    const stack = splitPath(path);
    for (let i = 0; i < routes.length; i++) {
        const state = routes[i];
        // 优先匹配children
        let matched = matchPath(path, state.children);
        if (matched) return matched;
        let matchedParams = matchPathParams(stack, state.pathStack);
        if (matchedParams) {
            let matchedState = state;
            let redirected = false;
            let redirectUrl = '';
            // 先检查是否有redirect
            if (state.redirectTo) {
                redirected = true;
                if (state.isRedirectToRoot) {
                    redirectUrl = state.redirectTo;
                    const redirectState = matchPath(redirectUrl, routes);
                    if (!redirectState) return null;
                    // 如果被重定向过
                    if (redirectState.redirected) {
                        redirectUrl = redirectState.redirectUrl;
                    }
                    matchedState = redirectState.state;
                    matchedParams = redirectState.params;
                } else {
                    matchedState = findWithRedirectState(state.redirectTo, routes);
                    stack.pop();
                    redirectUrl = stack.join('/');
                    redirectUrl = joinPath(redirectUrl, matchedState.config.path || '');
                }
            }
            return {
                redirected: redirected,
                redirectUrl: redirectUrl,
                state: matchedState,
                params: matchedParams,
            }
        }
    }
    return null;
}


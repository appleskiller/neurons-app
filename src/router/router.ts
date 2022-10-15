import { emitter, EventEmitter, IEmitter } from "neurons-emitter";
import { INavigateData, INavigateError, INavigateState, IRouter, IRouterConfig, IRouterGuard, IRouterOption, IRouterState } from "./interfaces";
import { matchPath, path2SearchAttrs } from "./matcher";
import { joinPath, parseToRouterStates } from "./parser";

function isPromiseLike(p): boolean {
    return p && ('then' in p) && (typeof p.then === 'function');
}
function isJQPromise(p): boolean {
    return isPromiseLike(p) && ('fail' in p) && (typeof p.fail === 'function');
}
function isPromise(p): boolean {
    return isPromiseLike(p) && ('catch' in p) && (typeof p.catch === 'function');
}

function isObservabeLike(o): boolean {
    return o && ('subscribe' in o) && (typeof o.subscribe === 'function');
}

function asPromise(p): Promise<any> {
    if (isObservabeLike(p)) {
        return new Promise((resolve, reject) => {
            const subscription = p.subscribe(result => {
                resolve(result);
                // 延迟取消订阅，避免同步调用造成的subscription尚未定义的问题
                setTimeout(() => subscription.unsubscribe());
            }, error => {
                reject(error);
                // 延迟取消订阅，避免同步调用造成的subscription尚未定义的问题
                setTimeout(() => subscription.unsubscribe());
            });
        });
    } else if (isPromiseLike(p)) {
        if (isPromise(p)) return p;
        if (isJQPromise(p)) {
            return new Promise((resolve, reject) => {
                p.then(resolve).fail(reject);
            });
        }
    }
    return null;
}

export class Router implements IRouter {
    constructor() {}

    private _nativeEmitter: EventEmitter = new EventEmitter();

    beforeNavigateChange: IEmitter<INavigateData> = emitter('before_navigate_change', this._nativeEmitter);
    navigateChange: IEmitter<INavigateData> = emitter('navigate_change', this._nativeEmitter);
    afterNavigateChange: IEmitter<INavigateData> = emitter('after_navigate_change', this._nativeEmitter);

    navigateNotFounded: IEmitter<INavigateData> = emitter('navigate_not_founded', this._nativeEmitter);
    navigateError: IEmitter<INavigateError> = emitter('navigate_Error', this._nativeEmitter);

    startNavigation: IEmitter<INavigateData> = emitter('start_navigation', this._nativeEmitter);
    endNavigation: IEmitter<INavigateData> = emitter('end_navigation', this._nativeEmitter);

    private _option: IRouterOption = {
        useHash: true,
    }
    private _currentState: INavigateState;
    private _host: string;
    private _routes: IRouterState[];
    private _cancelNavigating;

    get routes(): IRouterState[] {
        return this._routes;
    }
    get currentState(): INavigateState {
        return this._currentState;
    }

    initialize(routes: IRouterConfig[], option?: IRouterOption) {
        Object.assign(this._option, option || {});
        this._routes = parseToRouterStates(routes || []);
        // 监听hash change
        // window.addEventListener('hashchange', (event: HashChangeEvent) => {
        //     console.log(event);
        // });
        // 监听popstate
        window.addEventListener('popstate', (event: PopStateEvent) => {
            // matchPath(url, this._routes);
            const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            if (url === this._currentState.url) return;
            this.applyNavigate(url, (data: INavigateData) => {
                this._currentState = data.to;
            });
        });
        const initialUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        this.applyNavigate(initialUrl, (data: INavigateData) => {
            this._currentState = data.to;
            if (initialUrl !== this._currentState.url) {
                window.history.pushState({}, '', this._currentState.url);
            }
        });
    }
    match(path: string): {state: IRouterState; params: {param: string, value: string}[]} {
        return matchPath(path, this._routes);
    }
    navigate(path: string, triggerChange: boolean = true): void {
        if (!this._routes) return;
        path = this._normalizePath(path);
        if (this._currentState && path === this._currentState.url) return;
        this.applyNavigate(path, (data: INavigateData) => {
            this._currentState = data.to;
            window.history.pushState({}, '', path);
        });
    }
    replace(path: string, triggerChange: boolean = true): void {
        if (!this._routes) return;
        path = this._normalizePath(path);
        if (this._currentState && path === this._currentState.url) return;
        this.applyNavigate(path, (data: INavigateData) => {
            this._currentState = data.to;
            window.history.replaceState({}, '', path);
        });
    }
    go(): void {
        window.history.go();
    }
    forward(): void {
        if (!this._routes) return;
        window.history.forward();
    }
    back(): void {
        if (!this._routes) return;
        window.history.back();
    }
    
    destroy(): void {
        this._cancelNavigating && this._cancelNavigating();
        this._nativeEmitter.off();
    }
    protected applyNavigate(url: string, acceptCallback: (data: INavigateData) => void) {
        const skipEmitStart = !!this._cancelNavigating;
        this._cancelNavigating && this._cancelNavigating();
        this._cancelNavigating = null;
        const state = this._matchStateFromUrl(url);
        const data: INavigateData = {
            from: this._currentState,
            to: state,
        };
        !skipEmitStart && this.startNavigation.emit(data);
        if (!state) {
            this.navigateNotFounded.emit(data);
            this.endNavigation.emit(data);
        } else {
            const token = {
                canceled: false,
                error: null,
            };
            this.canActivate(data, token).then(result => {
                if (token.canceled) return;
                if (token.error) {
                    this.navigateError.emit({
                        ...data,
                        error: token.error,
                    });
                    return;
                }
                if (result) {
                    this.beforeNavigateChange.emit(data);
                    acceptCallback && acceptCallback(data);
                    this.navigateChange.emit(data);
                    this.afterNavigateChange.emit(data);
                }
                this._cancelNavigating = null;
                this.endNavigation.emit(data);
            })
            this._cancelNavigating = () => { token.canceled = true };
        }
    }
    protected canActivate(data: INavigateData, token: {canceled: boolean; error: Error}): Promise<boolean> {
        const state = data && data.to && data.to.state ? data.to.state : null;
        const routerGuards = (state && state.routerGuard ? state.routerGuard : []).concat();
        return this._runRouterGuards(routerGuards, data, token);
    }
    // protected updateState(state: INavigateState) {
    //     this._currentState = state;
    // }
    private _runRouterGuards(routerGuards: IRouterGuard[], data: INavigateData, token: {canceled: boolean; error: Error}): Promise<boolean> {
        if (token.canceled) return Promise.resolve(false);
        if (!routerGuards || !routerGuards.length) return Promise.resolve(true);
        const guard = routerGuards.shift();
        if (guard && typeof guard.canActivate === 'function') {
            const result = guard.canActivate(data);
            if (result === false) return Promise.resolve(false);
            if (!result || result === true) {
                return this._runRouterGuards(routerGuards, data, token);
            } else {
                return asPromise(result).then(ret => {
                    if (token.canceled) return Promise.resolve(false);
                    if (ret === false) return Promise.resolve(false);
                    return this._runRouterGuards(routerGuards, data, token);
                }).catch(error => {
                    if (token.canceled) return Promise.resolve(false);
                    token.error = error;
                    return Promise.resolve(false);
                });
            }
        } else {
            return Promise.resolve(true);
        }
    }
    private _rebuildUrlCauseByHash(url: string, hashIndex: number, redirectUrl: string) {
        const head = hashIndex !== -1 ? url.substring(0, hashIndex) : url;
        let searchIndex = hashIndex !== -1 ? url.indexOf('?', hashIndex) : -1;
        const search = searchIndex === -1 ? '' : url.substring(searchIndex);
        if (hashIndex !== -1) {
            if (!redirectUrl || redirectUrl === '/') {
                return !search ? head : joinPath(head, '#') + '/' + search;
            } else {
                return joinPath(head, '#') + redirectUrl + search;
            }
        } else {
            // url上无hash
            if (!redirectUrl || redirectUrl === '/') {
                return url;
            } else {
                return joinPath(url, '#') + redirectUrl;
            }
        }
    }
    private _rebuildUrlCauseByPathname(url: string, hashIndex: number, redirectUrl: string) {
        let head = hashIndex !== -1 ? url.substring(0, hashIndex) : url;
        const searchIndex = head.indexOf('?');
        const search = searchIndex === -1 ? '' : head.substring(searchIndex);
        const hash = hashIndex !== -1 ? url.substring(hashIndex) : '';
        return hash ? joinPath(redirectUrl + search, hash) : redirectUrl + search;
    }
    private _matchStateFromUrl(url: string): INavigateState {
        url = url || '';
        const searchAttrs = path2SearchAttrs(url);
        const hashIndex = url.indexOf('#');
        const hash = hashIndex !== -1 ? url.substring(hashIndex) : '';
        const pathname = hashIndex !== -1 ? url.substring(0, hashIndex) : url;
        let matched;
        if (this._option.useHash) {
            matched = matchPath(hash, this._routes);
            // 处理重定向，替换hash
            if (matched && matched.redirected) {
                url = this._rebuildUrlCauseByHash(url, hashIndex, matched.redirectUrl);
            }
        } else {
            matched = matchPath(pathname, this._routes);
            // 处理重定向，替换pathname
            if (matched && matched.redirected) {
                url = this._rebuildUrlCauseByPathname(url, hashIndex, matched.redirectUrl);
            }
        }
        return matched ? {
            url: url,
            state: matched.state,
            params: matched.params,
            search: searchAttrs,
        } : null;
    }
    private _normalizePath(path: string): string {
        path = path.charAt(0) === '/' ? path.substring(1) : path;
        path = path.charAt(0) === '#' ? path.substring(1) : path;
        path = path.charAt(0) === '/' ? path.substring(1) : path;
        if (this._option.useHash) {
            path = '/#/' + path;
        } else {
            path = '/' + path;
        }
        return path;
    }
}

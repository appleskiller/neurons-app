

import { IEmitter } from 'neurons-emitter';

export interface ObservableLike<T> {
    subscribe(next?: (value: T) => void, error?: (error: any) => void, complete?: () => void): any;
    pipe(...operations: any[]): ObservableLike<any>;
}

export interface INavigateState {
    url: string;
    state: IRouterState,
    params: {param: string, value: string | number}[],
    search: {param: string, value: string | number | (string | number)[]},
}

export interface INavigateData {
    from: INavigateState,
    to: INavigateState,
}

export interface INavigateError extends INavigateData {
    error: Error;
}

export interface RouterGuardClass {
    new(): IRouterGuard;
}

export interface IRouterGuard {
    canActivate(navigateData: INavigateData): boolean | ObservableLike<boolean> | Promise<boolean>;
    // canLoad()
}

export interface IRouterConfig {
    path: string;
    redirectTo?: string;
    component?: any;
    routerGuard?: RouterGuardClass[];
    children?: IRouterConfig[];
}

export interface IRouterState {
    path: string;
    pathStack: {path: string, param?: string, value?: string}[];
    config: IRouterConfig;
    isRedirectToRoot: boolean;
    redirectTo?: string;
    routerGuard?: IRouterGuard[];
    parent?: IRouterState;
    children?: IRouterState[];
    component?: any;
}

export interface IRouterOption {
    useHash?: boolean;
}

export interface IRouter {
    readonly routes: IRouterState[];
    readonly currentState: INavigateState;
    beforeNavigateChange: IEmitter<INavigateData>;
    navigateChange: IEmitter<INavigateData>;
    afterNavigateChange: IEmitter<INavigateData>;
    navigateNotFounded: IEmitter<INavigateData>;
    navigateError: IEmitter<INavigateError>;
    initialize(routes: IRouterConfig[], options?: IRouterOption): void;
    match(path: string): {state: IRouterState; params: {param: string, value: string}[]};
    navigate(url: string, triggerChange?: boolean): void;
    replace(url: string, triggerChange?: boolean): void;
    go(): void;
    forward(): void;
    back(): void;

    destroy(): void;
}

export interface IRouterStatic {
    new (): IRouter;
}

export interface IApplicationOption {
    // router
    Router?: IRouterStatic;
    routes?: IRouterConfig[];
    routerOption?: IRouterOption;
    // preloader
    usePreloader?: boolean;
    manualHidePreloader?: boolean;
    preloaderTasks?: (() => Promise<void>)[];
}

export const noop = {};
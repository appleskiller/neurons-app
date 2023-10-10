
import { bind } from 'neurons';
import { ClassLike, Provider, IInjector } from 'neurons-injector';
import { BindingSelector, BindingTemplate, IBindingDefinition, IBindingRef, IUIStateStatic, IElementOptions } from 'neurons/binding/common/interfaces';
import { preloader } from '../preloader';
import { Router } from '../router';
import { APP_TOKENS } from './tokens';
import './routeroutlet';
import { IApplicationOption, IRouter } from '../router/interfaces';

export interface IBootstrapOptions {
    state?: any;
    hostBinding?: IBindingDefinition;
    providers?: Provider[];
    parentInjector?: IInjector;
    requirements?: ClassLike[];
    skipError?: boolean;
}

export class NeBootstrapError extends Error {
    constructor(message: string, causeError?: Error) {
        super(message);
        if (causeError) {
            this.message = `${message}\n${causeError.message}`
            this.stack = causeError.stack;
        }
    }
}

const defaultAppOption: IApplicationOption = {
    Router: Router,
}

const privateKey = {};
export class NeApp {
    constructor(key, option: IApplicationOption) {
        if (key !== privateKey) throw new Error('');
        this.option = {
            ...defaultAppOption,
            ...(option || {})
        }
    }
    protected option: IApplicationOption;
    protected appRouter: IRouter
    protected appRef: IBindingRef<any>;
    protected routerRef: IBindingRef<any>;
    bootstrap(
        source: BindingSelector | BindingTemplate | ClassLike,
        option?: {
            state?: any;
            hostBinding?: IBindingDefinition;
            providers?: Provider[];
            requirements?: ClassLike[];
        },
    ): Promise<void> {
        if (!source) return Promise.reject(new NeBootstrapError('应用启动失败。请为bootstrap函数指定有效的source参数，它可以是一个绑定选择器，一段绑定模板，或是一个有效的组件类'));
        const element = window.document.body.querySelector('ne-app-root');
        if (!element) return Promise.reject(new NeBootstrapError('应用启动失败。请将<ne-app-root/>标签放置于文档（如index.html）的合适位置，以便启动函数能够在正确的文档位置启动应用'));
        const placeholder = document.createComment('');
        if (!element.parentNode) return Promise.reject(new NeBootstrapError('应用启动失败。请确保在应用启动时<ne-app-root/>标签已经插入到文档中。'))
        element.parentNode.insertBefore(placeholder, element);
        element.parentNode.removeChild(element);
        
        option = {
            ...(option || {}),
            placeholder: placeholder,
        } as IElementOptions<any>;
        option.providers = option.providers || [];
        option.state = option.state || {};

        // router
        const RouterClass = this.option.Router || Router;
        this.appRouter = new RouterClass();
        this.appRouter.initialize(this.option.routes || [], this.option.routerOption || {});
        // 注册router事件
        // this.appRouter.beforeNavigateChange.listen(() => console.log('before navigate change'));
        // this.appRouter.navigateChange.listen(() => console.log('navigate change'));
        // this.appRouter.afterNavigateChange.listen(() => console.log('after navigate change'));
        // this.appRouter.navigateNotFounded.listen(() => console.log('navigate not founded'));
        // this.appRouter.navigateError.listen(() => console.log('navigate error'));
        // this.appRouter.startNavigation.listen(() => console.log('start navigation'));
        // this.appRouter.endNavigation.listen(() => console.log('end navigation'));
        // 注入router
        option.providers.push({
            token: APP_TOKENS.APP_ROUTER,
            use: this.appRouter
        });
        // 注入preloader
        option.providers.push({
            token: APP_TOKENS.APP_PRELOADER,
            use: preloader
        });
        // 处理预加载
        return this.preload().then(() => {
            try {
                this.appRef = bind(source, option);
            } catch (error) {
                return this.bootstrapError(new NeBootstrapError('应用启动失败', error));
            }
            return this.bootstrapSuccess();
        }).catch(error => {
            return this.bootstrapError(new NeBootstrapError('应用预加载失败', error));
        })
    }
    protected preload(): Promise<any> {
        if (!this.option.usePreloader || !this.option.preloaderTasks || !this.option.preloaderTasks.length) return Promise.resolve();
        preloader.show();
        return Promise.all(this.option.preloaderTasks.map(task => task()))
    }
    protected bootstrapSuccess(): Promise<void> {
        if (!this.option.usePreloader || !this.option.preloaderTasks || !this.option.preloaderTasks.length) return Promise.resolve();
        if (!!this.option.manualHidePreloader) return Promise.resolve();
        preloader.hide();
        return Promise.resolve();
    }
    protected bootstrapError(error): Promise<any> {
        if (!this.option.usePreloader || !this.option.preloaderTasks || !this.option.preloaderTasks.length) return Promise.reject(error);
        if (!!this.option.manualHidePreloader) return Promise.reject(error);
        preloader.error(error.message, error, () => {
            window.location.reload();
        });
        return Promise.reject(error);
    }
}

export function createApplication(option?: IApplicationOption): NeApp {
    return new NeApp(privateKey, option);
}
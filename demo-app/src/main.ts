
import { createApplication, preloader } from '../../src';
import { DemoApp } from './app/app';
import { routes } from './app/app-routes';

createApplication({
    routes: routes,
    routerOption: {
        useHash: true,
    }
}).bootstrap(
    DemoApp
).catch(error => {
    preloader.error('系统加载失败', error, () => {
        window.location.reload();
    });
});
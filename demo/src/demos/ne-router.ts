import { appendCSSTagOnce } from "../utils";
import { register } from "../demos";
import { Router } from "../../../src";
import { addClass } from "../utils";
import { matchPath } from "../../../src/router/matcher";
import { INavigateData, IRouterGuard } from "../../../src/router/interfaces";

appendCSSTagOnce('ne-router-demo', `
    .routes-parse-panel {
        position: relative;
        width: 100%;
    }
    .routes-parse-panel .routes-parse-panel-left {
        display: inline-block;
        vertical-align: top;
        width: 49%;
        border-right: solid 1px #EEE;
    }
    .routes-parse-panel .routes-parse-panel-right {
        display: inline-block;
        vertical-align: top;
        width: 49%;
    }
    .routes-parse-panel .route-item-label {
        padding: 0 12px;
        line-height: 32px;
        border-bottom: solid 1px #EEE;
    }
    .routes-parse-panel .route-item-children {
        padding-left: 24px;
    }
`)
const router = new Router();
class RouterGuard implements IRouterGuard {
    canActivate(navigateData: INavigateData): boolean {
        router.navigate('page_1');
        return false;
    }
}
class AsyncRouterGuard implements IRouterGuard {
    canActivate(navigateData: INavigateData): boolean {
        setTimeout(() => {
            router.navigate('page_1');
        }, 3000);
        return false;
    }
}
const routes = [{
    path: 'page_1',
}, {
    path: 'page_1/page_1_1',
}, {
    path: 'page_1/page_1_2',
    redirectTo: 'page_1/page_1_3'
}, {
    path: 'page_1/page_1_3',
}, {
    path: 'page_2',
}, {
    path: 'page_2/:id/:type',
}, {
    path: 'page_3',
    children: [{
        path: 'page_3_1',
    }, {
        path: 'page_3_2',
        redirectTo: 'page_3_3'
    }, {
        path: 'page_3_3',
        redirectTo: 'page_3_4'
    }, {
        path: 'page_3_4',
    }, {
        path: '*',
    }, {
        path: '**',
    }]
}, {
    path: 'page_guard_redirect',
    routerGuard: [RouterGuard],
}, {
    path: 'page_guard_async_redirect',
    routerGuard: [AsyncRouterGuard],
}, {
    path: '*',
}, {
    path: '**',
}]

router.beforeNavigateChange.listen(() => console.log('before navigate change'));
router.navigateChange.listen(() => console.log('navigate change'));
router.afterNavigateChange.listen(() => console.log('after navigate change'));
router.navigateNotFounded.listen(() => console.log('navigate not founded'));
router.navigateError.listen(() => console.log('navigate error'));
router.startNavigation.listen(() => console.log('start navigation'));
router.endNavigation.listen(() => console.log('end navigation'));

router.initialize(routes, {
    useHash: true,
});

function createRouteListDom(routes: any[], container: HTMLElement, childrenField: string): void {
    (routes || []).forEach(route => {
        const dom = document.createElement('div');
        addClass(dom, 'route-item');
        container.appendChild(dom);
        const label = document.createElement('div');
        addClass(label, 'route-item-label');
        const params = route.pathStack ? route.pathStack.map(item => item.param).filter(p => !!p) : [];
        label.innerHTML = `path: ${route.path};${route.redirectTo ? ` redirectTo: ${route.redirectTo}` : ''}${params.length ? ` params: ${params.join(', ')}` : ''}`;
        dom.appendChild(label);
        if (route[childrenField] && route[childrenField].length) {
            const content = document.createElement('div');
            addClass(content, 'route-item-children');
            dom.appendChild(content);
            createRouteListDom(route[childrenField], content, childrenField);
        }
    })
}

register({
    title: 'ne-router',
    cases: [
        {
            title: 'parse routes',
            bootstrap: container => {
                const content = document.createElement('div');
                addClass(content, 'routes-parse-panel');
                container.appendChild(content);
                const originDom = document.createElement('div');
                addClass(originDom, 'routes-parse-panel-left');
                createRouteListDom(routes, originDom, 'children');
                content.appendChild(originDom);
                const routerDom = document.createElement('div');
                addClass(routerDom, 'routes-parse-panel-right');
                createRouteListDom(router.routes, routerDom, 'children');
                content.appendChild(routerDom);
                console.log('configs:', routes);
                console.log('parsed:', router.routes);
            }
        }, {
            title: 'match routes',
            bootstrap: container => {
                const btnContainer = document.createElement('div');
                container.appendChild(btnContainer);
                ['page_1/page_1_1', 'page_2/some_id/some_type', 'page_3/page_3_2', 'page_3/page_3_x', 'page_3/page_3_x/page_3_x_y', 'page', 'page/4', 'page_guard_redirect'].forEach(path => {
                    const btn = document.createElement('button');
                    btn.innerHTML = `测试：${path}`;
                    btn.onclick = () => {
                        const matched = router.match(path);
                        if (matched) {
                            alert(`匹配路由：${matched.state.path}${matched.params.length ? `; 参数：${matched.params.map(p => `${p.param}: ${p.value}`).join(',')}` : ''}`)
                        } else {
                            alert('未匹配到有效路由');
                        }
                    };
                    btnContainer.appendChild(btn);
                })
                const testContainer = document.createElement('div');
                container.appendChild(testContainer);
            }
        }, {
            title: 'navigate',
            bootstrap: container => {
                const btnContainer = document.createElement('div');
                container.appendChild(btnContainer);
                ['/page_1/page_1_1', 'page_2/some_id/some_type', 'page_3/page_3_2', 'page/4', 'page_guard_redirect', 'page_guard_async_redirect', '/page_1', 'go', 'back', 'forward'].forEach(path => {
                    const btn = document.createElement('button');
                    if (path === '/page_1') {
                        btn.innerHTML = `替换为: ${path}`;
                    } else if (path === 'go' || path === 'back' || path === 'forward') {
                        btn.innerHTML = `${path}`;
                    } else {
                        btn.innerHTML = `转到：${path}`;
                    }
                    btn.onclick = () => {
                        if (path === '/page_1') {
                            router.replace(path);
                        } else if (path === 'go' || path === 'back' || path === 'forward') {
                            window.history[path]();
                        } else {
                            router.navigate(path);
                        }
                    };
                    btnContainer.appendChild(btn);
                })
            }
        }
    ]
})
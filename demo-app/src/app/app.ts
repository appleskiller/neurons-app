
import { Binding, Inject } from 'neurons';
import { APP_TOKENS, RouterOutlet } from '../../../src';
import { IRouter } from '../../../src/router/interfaces';

import './app-routes';

@Binding({
    selector: 'demo-app',
    template: `
        <ne-router-outlet></ne-router-outlet>
    `,
    style: `
    `,
    requirements: [
        RouterOutlet
    ]
})
export class DemoApp {
    @Inject(APP_TOKENS.APP_ROUTER) router: IRouter;

    text = 'asdfasdf';
    onInit() {
    }
    onClick(e) {
        console.log(e)
    }
}

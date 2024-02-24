
import { bind, Binding, BINDING_TOKENS, Element, Inject, Property } from 'neurons';
import { ClassLike, IInjector } from 'neurons-injector';
import { IBindingRef } from 'neurons/binding/common/interfaces';
import { INavigateState, IRouter } from '../router/interfaces';
import { APP_TOKENS } from './tokens';

@Binding({
    selector: 'ne-router-outlet',
    template: `<div #container></div>`,
    style: ''
})
export class RouterOutlet {
    @Element('container') container: HTMLElement;
    @Inject(BINDING_TOKENS.INJECTOR) injector: IInjector;
    @Inject(APP_TOKENS.APP_ROUTER) router: IRouter;

    protected placeholder: Comment;
    protected component: ClassLike;
    protected ref: IBindingRef<any>;

    onInit() {
        this.placeholder = document.createComment('');
        this.container.parentNode.insertBefore(this.placeholder, this.container);
        this.container.parentNode.removeChild(this.container);
        this.router && this.onNavigateChange(this.router.currentState);
        this.router.navigateChange.listen(navigateData => {
            this.onNavigateChange(navigateData.to);
        })
    }
    onDestroy() {
        this.ref && this.ref.destroy();
    }
    protected onNavigateChange(navigateState: INavigateState) {
        const component = navigateState && navigateState.state.component ? navigateState.state.component : null;
        if (this.component !== component) {
            this.component = component;
            this.ref && this.ref.destroy();
            this.ref = null;
            this.ref = this.createComponent(this.component);
        }
    }
    protected createComponent(component: ClassLike) {
        if (!component) return null;
        const ref = bind(component, {
            placeholder: this.placeholder,
            state: {},
            parentInjector: this.injector
        });
        return ref;
    }
}



import { Binding } from 'neurons';

@Binding({
    selector: 'demo-home',
    template: `
        <div class="demo-home">
            <h1>Neurons App Demo</h1>
            <div class="demo-home-navi">
                <span>首页</span>
                <a href="#/about">关于</a>
            </div>
            <div class="demo-home-content">
                <div>欢迎访问Neurons应用演示页面！</div>
            </div>
        </div>
    `,
    style: `
        .demo-home {
            .demo-home-navi {
                padding: 12px 24px;
                background: #EEE;
                & > * {
                    margin-right: 12px;
                }
            }
            .demo-home-content {
                padding: 12px 24px;
            }
        }
    `,
    requirements: [
        
    ]
})
export class DemoHome {
}


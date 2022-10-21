
const fs = require('fs-extra');
const net = require('net');
const path = require('path');
const webpack = require('webpack');
const Server = require('webpack-dev-server');

const defaultArgs = {
    index: 'src/index.html',
    output: './dist',
    public: '',
};

/* <link rel="icon" type="image/x-icon" href="favicon.ico"></link> */
/* <link rel="stylesheet" type="text/css" href="theme.css" /> */
const linkRegexp = /\<\s*link[^\>]+?rel\s*\=\s*[\'|\"]\s*(icon|stylesheet)\s*[\'|\"][\s\S]*?\>/;
const hrefRegexp = /href\s*\=\s*[\'|\"]([\s\S]*?)[\'|\"]/
// <script src="pkg-aliases/THREE.MeshLine.js"></script>
const scriptRegexp = /\<\s*script[^\>]+?\>/;
const srcRegexp = /src\s*\=\s*[\'|\"]([\s\S]*?)[\'|\"]/;
const urlRegexp = /[a-zA-Z]+:\/\/[^\s]*/;

function generateWebpackConfig(config, baseConfig, extraConfig) {
    const polyfills = config.polyfills ? path.resolve(config.polyfills) : '';
    const main = path.resolve(config.main);
    const entry = {};
    // polyfills
    polyfills && (entry.polyfills = polyfills);
    // externals
    
    // main
    entry.main = main;
    const webpackConfig = {
        entry: entry,
        devtool: 'source-map',
        output: {
            filename: '[name].[hash].js'
        },
        ...(baseConfig || {}),
        ...(extraConfig || {})
    };
    // output path
    webpackConfig.output = webpackConfig.output || {};
    webpackConfig.output.path = path.resolve(config.output || defaultArgs.output, config.public || defaultArgs.public);
    return webpackConfig;
}

function collectChunkFiles(stats) {
    if (!stats || !stats.compilation || !stats.compilation.entrypoints) return [];
    const result = [];
    const entrypoints = stats.compilation.entrypoints;
    // polyfills
    const polyfillsEntry = entrypoints.get('polyfills');
    if (polyfillsEntry && polyfillsEntry.runtimeChunk && polyfillsEntry.runtimeChunk.files) {
        result.push(polyfillsEntry.runtimeChunk.files);
    }
    // others
    stats.compilation.entrypoints.forEach((value, key) => {
        if (key === 'polyfills' || key === 'main') return;
        if (value && value.runtimeChunk && value.runtimeChunk.files) {
            result.push(value.runtimeChunk.files);
        }
    });
    // main
    const mainEntry = entrypoints.get('main');
    if (mainEntry && mainEntry.runtimeChunk && mainEntry.runtimeChunk.files) {
        result.push(mainEntry.runtimeChunk.files);
    }
    return result;
}

function collectAssetsTags(content, result) {
    result = result || [];
    if (!content) return;
    const matched = content.match(linkRegexp);
    if (matched) {
        const tag = matched[0];
        const matchedHref = tag.match(hrefRegexp);
        if (matchedHref) {
            result.push({
                tag: tag,
                href: matchedHref[0],
                path: matchedHref[1],
                index: matched.index + matchedHref.index,
            });
        }
        content = content.substring(matched.index + tag.length);
        collectAssetsTags(content, result);
    }
    return result;
}
function collectScriptTags(content, result) {
    result = result || [];
    if (!content) return;
    const matched = content.match(scriptRegexp);
    if (matched) {
        const tag = matched[0];
        const matchedHref = tag.match(srcRegexp);
        if (matchedHref) {
            result.push({
                tag: tag,
                href: matchedHref[0],
                // href index
                index: matched.index + matchedHref.index,
                path: matchedHref[1],
            });
        }
        content = content.substring(matched.index + tag.length);
        collectScriptTags(content, result);
    }
    return result;
}

function assembleIndexContent(content, chunkFiles, neconfig) {
    const publicDir = neconfig.public || defaultArgs.public;
    const indexSourcePath = path.resolve(neconfig.index || defaultArgs.index);
    const indexDir = path.dirname(indexSourcePath);
    // 如果存在publicDir，则需要调整静态资源路径
    if (publicDir) {
        const urls = [];
        collectAssetsTags(content, urls);
        collectScriptTags(content, urls);
        // 倒序排列
        urls.sort((a, b) => {
            return b.index - a.index; 
        }).forEach(info => {
            const sourceRelativePath = info.path.trim();
            if (urlRegexp.test(sourceRelativePath)) return;
            const sourcePath = path.resolve(indexDir, sourceRelativePath);
            // 只处理相对index.html所在路径下的文件引用
            if (sourcePath.indexOf(indexDir) === 0) {
                const href = info.href.replace(info.path, publicDir + '/' + path.relative(indexDir, sourcePath).replace('\\\\', '/').replace('\\', '/'));
                content = content.substring(0, info.index) + href + content.substring(info.index + info.href.length);
            }
        })
    }
    // script
    const scriptContent = generateEntryScripts(chunkFiles, neconfig.public || '');
    content = content.replace(/\<\s*?\/\s*?body\s*?\>/, match => {
        return '\n        ' + scriptContent + '\n    ' + match;
    });
    return content;
}

function copyToDist(neconfig, stats) {
    const output = neconfig.output || defaultArgs.output;
    const publicDir = neconfig.public || defaultArgs.public;
    const indexSourcePath = path.resolve(neconfig.index || defaultArgs.index);
    const indexDir = path.dirname(indexSourcePath);
    const indexTargetPath = path.resolve(output, path.basename(indexSourcePath));
    let indexContent = fs.readFileSync(indexSourcePath, 'utf8');
    // 补充index.html内容
    const chunkFiles = collectChunkFiles(stats);
    indexContent = assembleIndexContent(indexContent, chunkFiles, neconfig);
    fs.writeFileSync(indexTargetPath, indexContent, 'utf8');
    // 复制额外静态资源文件
    const assets = neconfig.assets || [];
    assets.forEach(p => {
        const source = path.resolve(p);
        const relativePath = path.relative(indexDir, source);
        const target = path.resolve(output, publicDir, relativePath);
        if (fs.existsSync(source)) {
            console.log("Copy: " + source + " -> " + target);
            fs.copySync(source, target);
        }
    })
}

function runCommand(neconfig, cmd) {
    const webpackConfig = generateWebpackConfig(neconfig, neconfig.webpack || {}, neconfig[cmd] || {});
    fs.removeSync(webpackConfig.output.path);
    // console.log(webpackConfig);
    const compiler = webpack(webpackConfig, (err, stats) => {
        if (err) {
            console.log('Error: Compile Failed!', err.message);
            console.log(err);
        } else if (stats.hasErrors()) {
            console.log('Error: Compile Failed!');
            // 在这里处理错误
            if (stats.compilation && stats.compilation.errors && stats.compilation.errors.length) {
                stats.compilation.errors.forEach(error => {
                    console.log('Error:', error.message);
                    console.log(err);
                })
            }
        }
    })
    compiler.hooks.done.tap('ne-cli build', stats => {
        copyToDist(neconfig, stats);
        console.log('Compile completed!');
    })
}

const serverData = {
    server: null,
};
const signals = ['SIGINT', 'SIGTERM'];
function setupExitSignals(serverData) {
    signals.forEach((signal) => {
        process.on(signal, () => {
            if (serverData && serverData.server) {
                serverData.server.close(() => {
                    // eslint-disable-next-line no-process-exit
                    process.exit();
                });
            } else {
                // eslint-disable-next-line no-process-exit
                process.exit();
            }
        });
    });
}

function startDevServer(config, options, entryStats) {
    let compiler;
    try {
        compiler = webpack(config);
        compiler.hooks.done.tap('ne-cli serve', stats => {
            if (stats.hasErrors()) {
                return
            }
            entryStats.dirty = true;
            entryStats.files = collectChunkFiles(stats);
        })
    } catch (err) {
        if (err instanceof webpack.WebpackOptionsValidationError) {
            console.log('Error:', err.message);
            // eslint-disable-next-line no-process-exit
            process.exit(1);
        }
        throw err;
    }
    try {
        serverData.server = new Server(compiler, options);;
    } catch (err) {
        if (err.name === 'ValidationError') {
            console.log('Error:', err.message);
            // eslint-disable-next-line no-process-exit
            process.exit(1);
        }

        throw err;
    }
    const server = serverData.server;
    if (options.socket) {
        server.listeningApp.on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                const clientSocket = new net.Socket();
                clientSocket.on('error', (err) => {
                    if (err.code === 'ECONNREFUSED') {
                        // No other server listening on this socket so it can be safely removed
                        fs.unlinkSync(options.socket);
                        server.listen(options.socket, options.host, (error) => {
                            if (error) {
                                throw error;
                            }
                        });
                    }
                });

                clientSocket.connect({ path: options.socket }, () => {
                    throw new Error('This socket is already used');
                });
            }
        });
        server.listen(options.socket, options.host, (err) => {
            if (err) {
                throw err;
            }
            // chmod 666 (rw rw rw)
            const READ_WRITE = 438;
            fs.chmod(options.socket, READ_WRITE, (err) => {
                if (err) {
                    throw err;
                }
            });
        });
    } else {
        server.listen(options.port, options.host, (err) => {
            if (err) {
                throw err;
            }
        });
    }
}

function generateEntryScripts(entryFiles, public) {
    return (entryFiles || []).map(files => {
        let content = '';
        files.forEach(file => {
            if (path.extname(file) === '.js') {
                content += `<script type="text/javascript" src="${public ? public + '/' + file : file}"></script>`
            }
        })
        return content;
    }).join('');
}

function serve(neconfig) {
    setupExitSignals(serverData);
    const webpackConfig = generateWebpackConfig(neconfig, neconfig.webpack || {}, neconfig.serve || {});
    const devServerOptions = {
        ...webpackConfig.devServer,
    };
    devServerOptions.host = devServerOptions.host || '127.0.0.1';
    devServerOptions.port = devServerOptions.port || '8081';
    devServerOptions.proxy = devServerOptions.proxy || {};
    const entryStats = {
        dirty: true,
        files: [],
        scriptContent: '',
    };
    const indexPath = path.resolve(neconfig.index);
    devServerOptions.proxy['/index.html'] = {
        bypass: function (req, res, proxyOptions) {
            if (req.path === '/') {
                // 插入入口脚本
                let content = fs.readFileSync(indexPath, 'utf8');
                if (entryStats.dirty) {
                    entryStats.scriptContent = generateEntryScripts(entryStats.files, '');
                }
                content = content.replace(/\<\s*?\/\s*?body\s*?\>/, match => {
                    return '\n        ' + entryStats.scriptContent + '\n    ' + match;
                });
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=UTF-8',
                });
                res.end(content);
                return false;
            } else {
                return req.path;
            }
        }
    }
    startDevServer(webpackConfig, devServerOptions, entryStats);
}

exports.execute = function (helpText) {
    const args = require("yargs")
        .usage('run `ne-cli` serve to development, or run `ne-cli build` to build')
        .demand(1)
        .string("output").default("dist", defaultArgs.output)
            .describe("output", "指定output文件夹名称。")
        .string("public").default("", defaultArgs.public)
            .describe("public", "指定public文件夹名称。一旦指定，则除index之外的静态资源将被移动到public目录下")
        // .string("output").default("tsconfig", defaultArgs.output)
        //     .describe("output", "The output dir, defaults to using ./dist")
        .argv;
    const neconfig = require(path.resolve('./neconfig.js'));
    args.public && (neconfig.public = args.public);
    const cmdName = args._[0];
    if (cmdName === 'serve') {
        serve(neconfig);
    } else if (cmdName in neconfig) {
        runCommand(neconfig, cmdName);
    } else {
        console.log('Error: 未知命令！运行 ne-app-cli --help 获得更多帮助');
    }
}
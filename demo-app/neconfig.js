const path = require('path');
const webpack = require('webpack');

module.exports = {
    index: "src/index.html",
    main: "src/main.ts",
    polyfills: "src/polyfills.ts",
    output: "dist",
    public: 'public',
    assets: [
        "src/favicon.ico",
        "src/assets"
    ],

    webpack: {
        module: {
            rules: [{
                test: /\.tsx?$/,
                loader: ['awesome-typescript-loader']
            }, {
                test: /\.css$/,
                loader: ['style-loader', 'css-loader'],
            }]
        },
        resolve: {
            extensions: [".ts", ".tsx", ".js"],
            alias: {
                // '@shujujiang/core': path.resolve(__dirname, '../core/src/'),
                // '@shujujiang/schemas': path.resolve(__dirname, '../schemas/src/'),
                "neurons/*": path.resolve(__dirname, '../../neurons/src/*'),
                "neurons": path.resolve(__dirname, '../../neurons/src/'),
            }
        },
        performance: {
            hints: false
        }
    },

    build: {
        mode: "production",
        devtool: false
    },
    serve: {
        mode: "development",
        devtool: "source-map",
        plugins: [
            new webpack.HotModuleReplacementPlugin(),
            new webpack.HashedModuleIdsPlugin()
        ],
        devServer: {
            host: '127.0.0.1',
            port: 8081,
            contentBase: path.resolve(__dirname, './src'),
            watchContentBase: true,
            progress: true,
            compress: true,
            hot: true,
            open: true,
            historyApiFallback: {
                disableDotRule: true
            },
            watchOptions: {
                ignored: /node_modules/
            },
            overlay: {
                warnings: true,
                errors: true
            }
        }
    }
};
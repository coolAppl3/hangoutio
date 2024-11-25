const path = require('path');

const TerserPlugin = require("terser-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");

const buildEnvironment = 'production';

module.exports = {
  mode: buildEnvironment === 'production' ? 'production' : 'development',

  entry: {
    index: './src/ts/index.ts',
    createHangout: './src/ts/createHangout.ts',
    signIn: './src/ts/signIn.ts',
    signUp: './src/ts/signUp.ts',
    accountRecovery: './src/ts/accountRecovery.ts',
    hangout: './src/ts/hangout.ts',

    // error pages
    errorPage: './src/ts/modules/errorPages/errorPage.ts',
  },

  resolve: {
    extensions: ['.ts', '.js'],
  },

  output: {
    path: path.resolve(__dirname, '../public'),
    filename: buildEnvironment === 'production' ? 'js/[name]-[contenthash].js' : 'js/[name].js',
    clean: true,
    assetModuleFilename: (pathData) => {
      const { filename } = pathData;

      if (
        filename.endsWith('.woff') ||
        filename.endsWith('.woff2') ||
        filename.endsWith('.eot') ||
        filename.endsWith('.ttf') ||
        filename.endsWith('.otf') ||
        filename.endsWith('.otf')
      ) {
        return 'assets/fonts/[name][ext]';
      };

      if (
        filename.endsWith('.png') ||
        filename.endsWith('.jpg') ||
        filename.endsWith('.jpeg') ||
        filename.endsWith('.gif') ||
        filename.endsWith('.svg')
      ) {
        return 'assets/images/[name][ext]';
      };

      return 'assets/[name][ext]';
    },
  },

  devServer: {
    static: {
      directory: path.resolve(__dirname, '../public'),
    },
    port: 3000,
    open: true,
    hot: true,
    watchFiles: ['./src/html/**/*.html'],
    compress: true,
    historyApiFallback: true,

    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      };

      devServer.app.use((req, res, next) => {
        const requestBasename = path.basename(req.path);

        if (!req.url.includes('.') && !req.url.endsWith('/')) {
          req.url = requestBasename === 'home' ? req.url.replace(requestBasename, 'index.html') : req.url.replace(requestBasename, `${requestBasename}.html`);
        };

        next();
      });

      return middlewares;
    },
  },

  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          buildEnvironment === 'development' ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
          'sass-loader',
        ],
      },

      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },

      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        exclude: /node_modules/,
        type: 'asset/resource',
      },
    ],
  },

  plugins: [
    new MiniCssExtractPlugin({ filename: '[name]-[contenthash].css' }),

    new CopyPlugin({
      patterns: [
        { from: "src/assets/", to: "assets/" },
      ],
    }),

    // index.html
    new HtmlWebpackPlugin({
      title: 'Home - Hangoutio',
      filename: 'index.html',
      template: 'src/html/index.html',

      chunks: [
        "index"
      ],
    }),

    // create-hangout.html
    new HtmlWebpackPlugin({
      title: 'Create a Hangout - Hangoutio',
      filename: 'create-hangout.html',
      template: 'src/html/create-hangout.html',

      chunks: [
        "createHangout"
      ],
    }),

    // sign-in.html
    new HtmlWebpackPlugin({
      title: 'Sign In - Hangoutio',
      filename: 'sign-in.html',
      template: 'src/html/sign-in.html',

      chunks: [
        "signIn"
      ],
    }),

    // sign-up.html
    new HtmlWebpackPlugin({
      title: 'Sign Up - Hangoutio',
      filename: 'sign-up.html',
      template: 'src/html/sign-up.html',

      chunks: [
        "signUp"
      ],
    }),

    // account-recovery.html
    new HtmlWebpackPlugin({
      title: 'Account Recovery - Hangoutio',
      filename: 'account-recovery.html',
      template: 'src/html/account-recovery.html',

      chunks: [
        "accountRecovery"
      ],
    }),

    // hangout.html
    new HtmlWebpackPlugin({
      title: 'Hangout - Hangoutio',
      filename: 'hangout.html',
      template: 'src/html/hangout.html',

      chunks: [
        "hangout"
      ],
    }),

    // error pages --- --- ---

    // 404.html
    new HtmlWebpackPlugin({
      title: 'Not Found - Hangoutio',
      filename: 'errorPages/404.html',
      template: 'src/html/errorPages/404.html',

      chunks: [
        "errorPage"
      ],
    }),

    // 403.html
    new HtmlWebpackPlugin({
      title: 'Forbidden - Hangoutio',
      filename: 'errorPages/403.html',
      template: 'src/html/errorPages/403.html',

      chunks: [
        "errorPage"
      ],
    }),

    // 401.html
    new HtmlWebpackPlugin({
      title: 'Unauthorized- Hangoutio',
      filename: 'errorPages/401.html',
      template: 'src/html/errorPages/401.html',

      chunks: [
        "errorPage"
      ],
    }),
  ],

  optimization: {
    minimize: true,
    minimizer: [
      new CssMinimizerPlugin(),
      new TerserPlugin(),
    ],
  },
};
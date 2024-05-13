const path = require('path');

const TerserPlugin = require("terser-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");

process.env.NODE_ENV = 'production';

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',

  entry: {
    index: './src/ts/index.ts',
    createHangout: './src/ts/createHangout.ts',
  },

  resolve: {
    extensions: ['.ts', '.js'],
  },

  output: {
    path: path.resolve(__dirname, '../public'),
    filename: process.env.NODE_ENV === 'production' ? 'js/[name]-[contenthash].js' : 'js/[name].js',
    clean: true,
    assetModuleFilename: (pathData) => {
      const { filename } = pathData;

      if (filename.endsWith('.woff') || filename.endsWith('.woff2') || filename.endsWith('.eot') || filename.endsWith('.ttf') || filename.endsWith('.otf') || filename.endsWith('.otf')) {
        return 'assets/fonts/[name][ext]';
      };

      if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.gif') || filename.endsWith('.svg')) {
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
    watchFiles: ['./src/html/*.html'],
    compress: true,
    historyApiFallback: true,
  },

  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          process.env.NODE_ENV === 'development' ? 'style-loader' : MiniCssExtractPlugin.loader,
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
  ],

  optimization: {
    minimize: true,
    minimizer: [
      new CssMinimizerPlugin(),
      new TerserPlugin(),
    ],
  },
};
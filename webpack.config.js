/**
 * Created by guntherclaes on 03/04/2017.
 */
const path = require('path');

module.exports = {
  devtool: 'source-map',
  entry: ['babel-polyfill', './angular-sri-client/index.js'],
  output: {
    path: path.resolve(__dirname, 'angular-sri-client/dist'),
    filename: 'client.js',
    publicPath: '/angular-sri-client/dist/'
  },
  node: {
    fs: 'empty',
    net: 'empty',
    tls: 'empty'
  },
  module: {
    rules: [
      {
        test: /\.(js)$/,
        exclude: [/(node_modules)/],
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['env', {
                  targets: {
                    browsers: ['last 2 versions', 'safari >= 7']
                  }
                }]
              ]
            }
          }
        ]
      }
    ]
  }
};
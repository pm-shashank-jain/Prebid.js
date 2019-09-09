/**
 * This module adds CustomData module to the User ID module
 * The {@link module:modules/userId} module is required
 * @module modules/customDataSystem
 * @requires module:modules/userId
 */

import * as utils from '../../src/utils';

/** @type {Submodule} */
export const customDataSubmodule = {
  /**
   * used to link submodule with config
   * @type {string}
   */
  name: 'customData',
  /**
   * decode the stored id value for passing to bid requests
   * @function
   * @param {string} value
   * @returns {{customData:string}}
   */
  decode(value) {
    return { 'customData': value }
  },
  getDataFromCookieName(cookieName) {
    if (cookieName && window.document.cookie) {
      let m = window.document.cookie.match('(^|;)\\s*' + cookieName + '\\s*=\\s*([^;]*)\\s*(;|$)');
      return m ? decodeURIComponent(m[2]) : null;
    }
    return null;
  },
  /**
   * performs action to obtain id
   * @function
   * @returns {string}
   */
  getId(configParams) {
    var data = '';
    if (!configParams || (typeof configParams.cookieName !== 'string' && configParams.data != '' && configParams.data == null)) {
      utils.logError('User ID - customData submodule requires either data or cookie name to be defined');
      return;
    }
    try {
      if (configParams.cookieName) {
        data = this.getDataFromCookieName(configParams.cookieName);
      } else if (configParams.data) {
        data = configParams.data;
      }
    } catch (e) {}
    // check pubcid and return if valid was otherwise create a new id
    return (data) || '';
  }
};

import 'babel-polyfill';
import 'whatwg-fetch';
import _ from 'lodash';
import LeagueTooltipsDebug from 'debug';

(() => {
  const debug = LeagueTooltipsDebug('league-tooltips');
  window.leagueTooltips = {
    debug: LeagueTooltipsDebug,
    locale: 'en_US',
  };

  // $BASE_ROUTE won't be minified by Webpack and will be replaced on-the-fly
  // with the base route set in the middleware configuration
  // eslint-disable-next-line no-undef
  const BASE_ROUTE_FROM_CONFIG = $BASE_ROUTE || null;
  debug('Base route from config', BASE_ROUTE_FROM_CONFIG);
  if (!BASE_ROUTE_FROM_CONFIG) {
    debug('[league-tooltips] $BASE_ROUTE is not set');
  }
  const BASE_ROUTE = BASE_ROUTE_FROM_CONFIG || '/tooltips/';
  debug('Base route', BASE_ROUTE);

  const ALLOWED_DATAS = ['champion', 'item', 'summonerspell', 'rune', 'mastery', 'championspell'];

  const datasCache = {};

  function requestPatchVersion() {
    return new Promise(async (resolve, reject) => {
      debug('Requesting patch version');
      try {
        const patchResponse = await fetch(`${BASE_ROUTE}patch`);
        datasCache.patch = await patchResponse.json();
        const { err } = datasCache.patch;
        if (!patchResponse.status.toString().startsWith('2') || err) {
          debug(`Error when retrieving the patch. Code ${patchResponse.status} : ${patchResponse.statusText}, message : "${err}".`);
        }
      } catch (e) {
        reject(e);
      }
      debug('Requested patch version', datasCache.patch);
      resolve();
    });
  }

  function requestLocale() {
    return new Promise(async (resolve, reject) => {
      debug('Requesting locale');
      const { locale } = window.leagueTooltips;
      let jsonLocale = null;
      try {
        const localeResponse = await fetch(`${BASE_ROUTE}locale/${locale}`);
        if (!datasCache.locales) {
          datasCache.locales = {};
        }
        const localeData = await localeResponse.json();
        jsonLocale = localeData.locale;
        datasCache.locales[locale] = jsonLocale;
        const { err } = datasCache.locales[locale];
        if (!localeResponse.status.toString().startsWith('2') || err) {
          debug(`Error when retrieving the locale. Code ${localeResponse.status} : ${localeResponse.statusText}, message : "${err}".`);
        }
      } catch (e) {
        reject(e);
      }
      debug('Requested locale', jsonLocale);
      resolve();
    });
  }

  function requestLoadingTemplate() {
    return new Promise(async (resolve, reject) => {
      debug('Requesting loading template');
      try {
        const loadingHtmlResponse = await fetch(`${BASE_ROUTE}html/loading.html`);
        datasCache.loadingHtml = await loadingHtmlResponse.text();
      } catch (e) {
        datasCache.loadingHtml =
          `<div class="league-tooltip__info">
            <img src="<%= gifLink %>" alt="Loading ..." />
          </div>`;
        reject(e);
      }
      debug('Requested loading template');
      resolve();
    });
  }

  function requestErrorTemplate() {
    return new Promise(async (resolve, reject) => {
      debug('Requesting error template');
      try {
        const errorHtmlResponse = await fetch(`${BASE_ROUTE}html/error.html`);
        datasCache.errorHtml = await errorHtmlResponse.text();
      } catch (e) {
        datasCache.errorHtml =
          `<div class="league-tooltip__info">
            <h1 class="league-tooltip__title"><%= error %></h1>
          </div>`;
        reject(e);
      }
      debug('Requested error template');
      resolve();
    });
  }

  const tooltip = {
    id: 'league-tooltip',
    offsetx: 10,
    offsety: 10,
    x: 0,
    y: 0,
    tooltipElement: null,
    saveonmouseover: null,
  };

  tooltip.show = function show(e) {
    const htmlelement = e.target;

    if (document.getElementById) {
      this.tooltipElement = document.getElementById(this.id);
    } else if (document.all) {
      this.tooltipElement = document.all[this.id].style;
    }

    const loadingGifLink = `${BASE_ROUTE}assets/img/load.gif`;
    this.tooltipElement.innerHTML = _.template(datasCache.loadingHtml)({ gifLink: loadingGifLink });

    this.saveonmouseover = document.onmousemove;
    document.onmousemove = this.mouseMove;

    this.moveTo(this.x + this.offsetx, this.y + this.offsety);

    if (this.tooltipElement.style) {
      this.tooltipElement.style.visibility = 'visible';
    } else {
      this.tooltipElement.visibility = 'visible';
    }

    this.render(htmlelement.dataset);

    return false;
  };
  tooltip.hide = function hide() {
    if (this.tooltipElement.style) {
      this.tooltipElement.style.visibility = 'hidden';
    } else {
      this.tooltipElement.visibility = 'hidden';
    }
    document.onmousemove = this.saveonmouseover;
    this.tooltipElement.innerHTML = '';
  };

  tooltip.mouseMove = function mouseMove(e) {
    if (e.pageX !== undefined) { // gecko, konqueror,
      tooltip.x = e.pageX;
      tooltip.y = e.pageY;
    } else if (e !== undefined && e.x !== undefined && e.clientX === undefined) { // ie4
      tooltip.x = e.x;
      tooltip.y = e.y;
    } else if (e.clientX !== undefined) { // IE6,  IE7, IE5.5
      if (document.documentElement) {
        tooltip.x = e.clientX + (document.documentElement.scrollLeft || document.body.scrollLeft);
        tooltip.y = e.clientY + (document.documentElement.scrollTop || document.body.scrollTop);
      } else {
        tooltip.x = e.clientX + document.body.scrollLeft;
        tooltip.y = e.clientY + document.body.scrollTop;
      }
    } else {
      tooltip.x = 0;
      tooltip.y = 0;
    }

    tooltip.adjustBox();
  };

  tooltip.adjustBox = function adjustBox() {
    if (tooltip.x + tooltip.tooltipElement.clientWidth < window.innerWidth &&
        tooltip.y + tooltip.tooltipElement.clientHeight < window.innerHeight) {
      tooltip.moveTo(
        tooltip.x + tooltip.offsetx,
        tooltip.y + tooltip.offsety,
      );
    } else if (tooltip.x + tooltip.tooltipElement.clientWidth >= window.innerWidth &&
        tooltip.y + tooltip.tooltipElement.clientHeight < window.innerHeight) {
      tooltip.moveTo(
        tooltip.x - tooltip.tooltipElement.clientWidth - tooltip.offsetx,
        tooltip.y + tooltip.offsety,
      );
    } else if (tooltip.x + tooltip.tooltipElement.clientWidth < window.innerWidth &&
        tooltip.y + tooltip.tooltipElement.clientHeight >= window.innerHeight) {
      tooltip.moveTo(
        tooltip.x + tooltip.offsetx,
        tooltip.y - tooltip.tooltipElement.clientHeight - tooltip.offsety,
      );
    } else {
      tooltip.moveTo(
        tooltip.x - tooltip.tooltipElement.clientWidth - tooltip.offsetx,
        tooltip.y - tooltip.tooltipElement.clientHeight - tooltip.offsety,
      );
    }
  };

  tooltip.moveTo = function moveTo(xL, yL) {
    if (this.tooltipElement.style) {
      this.tooltipElement.style.left = `${xL}px`;
      this.tooltipElement.style.top = `${yL}px`;
    } else {
      this.tooltipElement.left = xL;
      this.tooltipElement.top = yL;
    }
  };

  tooltip.render = async function render(dataset) {
    let dataType = null;
    let dataParam = null;
    ALLOWED_DATAS.forEach((allowedData) => {
      if (dataset[allowedData]) {
        dataType = allowedData;
        dataParam = dataset[allowedData];
      }
    });

    if (!dataType) {
      debug('Ignoring invalid data type');
      return;
    }

    // If the patch is empty or errored, retry
    if (!datasCache.patch || datasCache.patch.err) {
      debug('Patch empty or errored : requesting patch version');
      await requestPatchVersion();
    }
    if (!datasCache.patch) {
      debug('Patch still empty : display error');
      this.tooltipElement.innerHTML = _.template(datasCache.errorHtml)({ error: 'Error : no patch version available.' });
      return;
    }
    if (datasCache.patch.err) {
      debug('Patch errored : display error');
      const patchErr = datasCache.patch.err;
      this.tooltipElement.innerHTML = _.template(datasCache.errorHtml)({ error: patchErr });
      return;
    }

    const { locale } = window.leagueTooltips;

    let locales = {};
    if (!{}.hasOwnProperty.call(datasCache, 'locales') ||
        !{}.hasOwnProperty.call(datasCache.locales, locale)) {
      await requestLocale();
    }
    locales = datasCache.locales[locale];

    const key = `${dataParam}_${locale}`;

    let templateHtml = null;
    if (!{}.hasOwnProperty.call(datasCache, dataType) ||
        !{}.hasOwnProperty.call(datasCache[dataType], key) ||
        !datasCache[dataType][key].template) {
      debug(`Requesting ${dataType} template`);
      try {
        const tooltipQuery = await fetch(`${BASE_ROUTE}html/${dataType}.html`);
        const tooltipHtml = await tooltipQuery.text();
        templateHtml = tooltipHtml;
      } catch (e) {
        debug(`Fail to request ${dataType} template : displaying error`);
        this.tooltipElement.innerHTML = _.template(datasCache.errorHtml)({ error: `Can't request ${dataType}.html` });
      }
      debug(`Requested ${dataType} template`);
    } else {
      debug(`Loading ${dataType} template from cache`);
      templateHtml = datasCache[dataType][key].template;
    }

    if (!templateHtml) {
      return;
    }

    const tooltipTemplate = _.template(templateHtml);

    let data;
    if (!{}.hasOwnProperty.call(datasCache, dataType) ||
        !{}.hasOwnProperty.call(datasCache[dataType], key) ||
        !datasCache[dataType][key].data) {
      debug(`Requesting ${dataType}/${dataParam} datas`, datasCache.patch);
      const queryUrl = `${BASE_ROUTE}${dataType}/${dataParam}?locale=${locale}`;
      try {
        const response = await fetch(queryUrl);
        data = await response.json();
      } catch (e) {
        debug(`Fail to request ${dataType}/${dataParam} datas : displaying error`);
        this.tooltipElement.innerHTML = _.template(datasCache.errorHtml)({ error: `Can't request ${dataType}/${dataParam}` });
      }
      if (data) {
        data = _.merge(data, { patchVersion: datasCache.patch });
      }
      debug(`Requested ${dataType}/${dataParam} datas`, data);
    } else {
      debug(`Loading ${dataType} datas from cache`);
      ({ data } = datasCache[dataType][key]); // For linting purposes (wtf AirBnb)
    }

    if (!data) {
      return;
    }

    if (data.err) {
      debug('Error from server : displaying error', data.err);
      this.tooltipElement.innerHTML = _.template(datasCache.errorHtml)({ error: data.err });
      return;
    }

    try {
      debug('Rendering datas in template');
      this.tooltipElement.innerHTML = tooltipTemplate({ ...data, locale: locales });
      debug('Rendered datas in template');
    } catch (e) {
      debug('Fail to render datas in template : displaying error', e);
      this.tooltipElement.innerHTML = _.template(datasCache.errorHtml)({ error: 'Display error' });
    }

    debug('Saving datas in cache');
    if (!datasCache[dataType]) {
      datasCache[dataType] = {};
    }
    datasCache[dataType][key] = {
      data,
      template: templateHtml,
    };

    tooltip.adjustBox();
  };

  async function initTips() {
    debug('Initializing league-tooltips');

    await Promise.all([
      requestPatchVersion(),
      requestLocale(),
      requestLoadingTemplate(),
      requestErrorTemplate(),
    ]);

    debug('Creating tooltip element');
    const tooltipElementDiv = document.createElement('div');
    tooltipElementDiv.id = 'league-tooltip';
    if (tooltipElementDiv.style) {
      tooltipElementDiv.style.visibility = 'hidden';
    } else {
      tooltipElementDiv.visibility = 'hidden';
    }
    document.body.insertBefore(tooltipElementDiv, document.body.childNodes[0]);
    debug('Created tooltip element');

    debug('Appending league-tooltips stylesheets');
    const cssLink = document.createElement('link');
    cssLink.href = `${BASE_ROUTE}styles/tooltip.css`;
    cssLink.type = 'text/css';
    cssLink.rel = 'stylesheet';
    cssLink.media = 'screen,print';
    document.getElementsByTagName('head')[0].appendChild(cssLink);
    debug('Appended league-tooltips stylesheets');

    debug('Adding listeners to .league-tooltip elements');
    const tooltips = document.getElementsByClassName('league-tooltip');
    tooltips.forEach((tooltipElement) => {
      tooltipElement.addEventListener('mouseover', tooltip.show.bind(tooltip));
      tooltipElement.addEventListener('mouseout', tooltip.hide.bind(tooltip));
    });
    debug('Added listeners');

    debug('Initialized league-tooltips');
  }

  // Use http://youmightnotneedjquery.com/#ready ?
  window.onload = () => {
    initTips();
  };
})();

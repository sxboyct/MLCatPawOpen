import axios from 'axios';
import cheerio from 'cheerio';
import { init as _init, detail as _detail, proxy, play } from '../../util/pan.js';
import { getChannelUsernameCache, getCountCache} from "../../website/tgsou.js";
import {getCache} from "../../website/tgserch.js";

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1';

const cardConfigs = {};
let channels = ['xx123pan', 'tianyirigeng', 'cloud189_group', 'QuarkFree', 'ucpanpan'];
let maxResultsPerChannel = 4; // Default value, will be updated in init
let base_url = 'https://t.me/s/'; // Default fallback URL

async function init(inReq, outResp) {
  await _init(inReq, outResp);

  const proxyurl = await getCache(inReq.server);
  base_url = `${proxyurl}/s/`;

  const channelStr = await getChannelUsernameCache(inReq.server);
  if (channelStr) {
    channels = channelStr.split(',').map(c => c.trim()).filter(Boolean);
  }

  if (inReq.body?.channels?.length) {
    channels = inReq.body.channels;
  }

  maxResultsPerChannel = await getCountCache(inReq.server);

  return {};
}

async function home(_inReq, _outResp) {
  return {
    class: channels.map(channel => ({
      type_id: channel,
      type_name: channel
    })),
  };
}

async function category(inReq, _outResp) {
  const typeId = inReq.body.type_id || channels[0];
  const pg = parseInt(inReq.body.page || 1);

  try {
    const cards = await getChannelCards(typeId, pg);
    return {
      page: pg,
      pagecount: cards.length > 0 ? pg + 1 : pg,
      list: cards
    };
  } catch {
    return { page: pg, pagecount: pg, list: [] };
  }
}

async function detail(inReq, _outResp) {
  const ids = Array.isArray(inReq.body.id) ? inReq.body.id : [inReq.body.id];
  const videos = [];

  for (const id of ids) {
    try {
      const vodFromUrl = await _detail(id);
      if (vodFromUrl?.froms && vodFromUrl?.urls) {
        videos.push({
          vod_play_from: vodFromUrl.froms,
          vod_play_url: vodFromUrl.urls
        });
      }
    } catch {}
  }
  return { list: videos };
}

async function search(inReq, _outResp) {
  const wd = inReq.body.wd;
  if (!wd) return { page: 1, pagecount: 1, list: [] };

  try {
    if (!maxResultsPerChannel) {
      maxResultsPerChannel = await getCountCache(inReq.server);
    }
    const results = await searchInChannels(wd);
    return { page: 1, pagecount: 1, list: results };
  } catch {
    return { page: 1, pagecount: 1, list: [] };
  }
}

async function getChannelCards(channel, page = 1) {
  let url = `${base_url}${channel}`;
  const headers = { 'User-Agent': UA };

  if (page > 1) {
    const cfg = cardConfigs[channel];
    if (cfg?.hasMore) {
      url = cfg.nextPage;
      headers['Referer'] = `${base_url}${channel}`;
      headers['X-Requested-With'] = 'XMLHttpRequest';
    } else return [];
  }

  try {
    const { data } = await axios.get(url, { headers });
    if (page > 1) {
      return parseMessagesFromHTML(
        data.slice(1, -1).replaceAll('\"', '"').replaceAll('\n', '').replaceAll('\/', '/'),
        channel
      );
    }
    return parseMessagesFromHTML(data, channel);
  } catch {
    return [];
  }
}

async function searchInChannels(keyword) {
  const encodedText = encodeURIComponent(keyword);
  const results = [];

  const promises = channels.map(async (channel) => {
    try {
      const { data } = await axios.get(
        `${base_url}${channel}?q=${encodedText}`,
        { headers: { 'User-Agent': UA } }
      );
      const cards = await parseMessagesFromHTML(data, channel, keyword);
      results.push(...cards.slice(0, maxResultsPerChannel));
    } catch {}
  });

  await Promise.allSettled(promises);
  return results;
}

function parseMessagesFromHTML(html, channelName, defaultTitle = '') {
  const $ = cheerio.load(html);
  const cards = [];

  $('div.tgme_widget_message_bubble').each((_, element) => {
    try {
      let title = '';
      const msgText = $(element).find('.tgme_widget_message_text').html() || '';
      const cleanHtml = msgText.replace(/<[^>]+>/g, '').replace(/【[^】]*】/g, '');

      for (const line of cleanHtml.split('<br>')) {
        const txt = line.trim();
        if (/(名称|名字|短剧|资源标题)(：|:)/.test(txt)) {
          title = txt.split(/：|:/)[1]?.trim().split(/（|\(|\[|(更新?至|全)/)[0];
          break;
        }
      }

      const links = [];
      $(element).find('.tgme_widget_message_text > a').each((_, a) => {
        const href = $(a).attr('href');
        if (href && /https:\/\/.+\/(s|t)\/.+/.test(href)) {
          links.push(href);
        }
      });

      if (!links.length) return;

      const style = $(element).find('.tgme_widget_message_photo_wrap').attr('style');
      const cover = style?.match(/image:url\('(.+)'\)/)?.[1] || '';

      const href = links[0];
      let panType = '未知';

      if (/www\.alipan\.com|www\.aliyundrive\.com/.test(href)) panType = '阿狸';
      else if (href.includes('pan.quark.cn')) panType = '夸父';
      else if (href.includes('drive.uc.cn')) panType = '优夕';
      else if (href.includes('cloud.189.cn')) panType = '天意';
      else if (href.includes('yun.139.com')) panType = '逸动';
      else if (/115\.com|anxia\.com|115cdn\.com/.test(href)) panType = '115';
      else if (/www\.123684\.com|www\.123865\.com|www\.123912\.com/.test(href)) panType = '123';

      cards.push({
        vod_id: href,
        vod_name: title || defaultTitle || '未命名',
        vod_pic: cover || '',
        vod_remarks: `${panType}:${channelName}`,
        vod_duration: channelName,
      });
    } catch {}
  });

  const nextPage = $('.js-messages_more_wrap a').attr('href');
  cardConfigs[channelName] = nextPage
    ? { hasMore: true, nextPage: `https://t.me${nextPage}` }
    : { hasMore: false };

  return cards;
}

export default {
  meta: {
    key: 'tgsearch',
    name: 'TG搜索',
    type: 3,
  },
  api: async (fastify) => {
    fastify.post('/init', init);
    fastify.post('/home', home);
    fastify.post('/category', category);
    fastify.post('/detail', detail);
    fastify.post('/play', play);
    fastify.post('/search', search);
    fastify.get('/proxy/:site/:what/:flag/:shareId/:fileId/:end', proxy);
  },
};
import req from '../../util/req.js';
import {init, proxy, play, detail as _detail} from '../../util/pan.js';
import {jsoup} from "../../util/htmlParser.js";
import {Cloud} from "../../util/cloud.js";
import axios from "axios";
import {PC_UA} from "../../util/misc.js";

const CUSTOM_HEADERS = {
    "cookie": "HMACCOUNT_BFESS=6BF4131F2D346AC8; BAIDUID_BFESS=074D05A61BAC10713B08151BCBB5E7C8:FG=1; ZFY=HMyObm7phQtwOkcgQWY6OBQYsx:ABX8bf0vbEsOUTHUY:C; BDUSS_BFESS=xzbVJzRHFEQ0dpNkExdDg1YTJxOG5hTzdJZUVQelN4TGZWYS14ZkV2c2RXd3RvSVFBQUFBJCQAAAAAAAAAAAEAAABdYPAlbGlmZcix0ru33bCytqgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB3O42cdzuNnRG",
    "host": "hm.baidu.com",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
}

const appConfig = {
    site: 'https://www.gying.org/',
    tabs: [
        {type_id: 'mv?page=', type_name: '电影'},
        {type_id: 'tv?page=', type_name: '剧集'},
        {type_id: 'ac?page=', type_name: '动漫'}
    ]
}

const pq = (html) => {
    const jsp = new jsoup();
    return jsp.pq(html);
}

async function home(_inReq, _outResp) {
    return {
        class: appConfig.tabs.map(tab => ({
            type_id: tab.ext.id,
            type_name: tab.name
        })),
        filters: {}
    };
}

async function category(inReq, _outResp) {
    const tid = inReq.body.id;
    const pg = inReq.body.page || 1;
    const url = `${appConfig.site}${tid}${pg}`;
    
    const {data} = await req.get(url, {
        headers: {
            ...CUSTOM_HEADERS,
            Referer: appConfig.site
        }
    });
    const $ = pq(data);
    
    const videos = [];
    const scriptContent = $('script').filter((_, script) => $(script).html().includes('_obj.header')).html();
    const jsonStart = scriptContent.indexOf('{');
    const jsonEnd = scriptContent.lastIndexOf('}') + 1;
    const inlistData = JSON.parse(scriptContent.slice(jsonStart, jsonEnd).inlist;

    inlistData.i.forEach((item, index) => {
        videos.push({
            vod_name: inlistData.t[index],
            vod_id: `${inlistData.ty}/${item}`,
            vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`,
            vod_remarks: inlistData.g[index]
        });
    });

    return {
        page: pg,
        pagecount: 999,
        limit: 20,
        total: 999,
        list: videos
    };
}

async function detail(inReq, _outResp) {
    const [ty, id] = inReq.body.id.split('/');
    const url = `${appConfig.site}res/downurl/${ty}/${id}`;
    
    const {data} = await req.get(url, {
        headers: {
            ...CUSTOM_HEADERS,
            Origin: appConfig.site
        }
    });
    const resp = JSON.parse(data);
    
    const vod = {
        vod_name: '',
        vod_play_from: '在线播放$$$网盘播放',
        vod_play_url: []
    };

    if(resp.playlist) {
        const onlineUrls = resp.playlist.map(p => 
            p.list.map((_, i) => `${appConfig.site}py/${p.i}/${i+1}`).join('#')
        ).join('$$$');
        vod.vod_play_url.push(onlineUrls);
    }

    if(resp.panlist) {
        const panUrls = resp.panlist.url.join('#');
        vod.vod_play_url.push(panUrls);
    }

    return {list: [vod]};
}

async function search(inReq, _outResp) {
    const wd = encodeURIComponent(inReq.body.wd);
    const pg = inReq.body.page || 1;
    const url = `${appConfig.site}/s/1---${pg}/${wd}`;

    const {data} = await req.get(url, {
        headers: {
            ...CUSTOM_HEADERS,
            Referer: `${appConfig.site}/search/`
        }
    });
    const $ = pq(data);
    
    const videos = [];
    $('.v5d').each((index, element) => {
        const a = $(element).find('a');
        videos.push({
            vod_name: $(element).find('b').text(),
            vod_id: a.attr('href'),
            vod_pic: $(element).find('source').attr('data-srcset'),
            vod_remarks: $(element).find('p').text()
        });
    });

    return {
        page: pg,
        pagecount: 1,
        list: videos
    };
}

export default {
    meta: {
        key: 'guanying',
        name: '观影网',
        type: 3
    },
    api: async (fastify) => {
        fastify.post('/init', init);
        fastify.post('/home', home);
        fastify.post('/category', category);
        fastify.post('/detail', detail);
        fastify.post('/play', play);
        fastify.post('/search', search);
        fastify.get('/proxy/:site/:what/:flag/:shareId/:fileId/:end', proxy);
    }
};

import req from '../../util/req.js';
import {init, proxy, play, detail as _detail} from '../../util/pan.js';
import {jsoup} from "../../util/htmlParser.js";
import axios from "axios";
import {PC_UA} from "../../util/misc.js";

const appConfig = {
	ver: 1,
	title: 'SeedHub',
	site: 'https://www.seedhub.cc',
	tabs: [
		{
			name: '首页',
			ext: {
				id: '/',
			},
		},
		{
			name: '电影',
			ext: {
				id: '/categories/1/movies/',
			},
		},
		{
			name: '剧集',
			ext: {
				id: '/categories/3/movies/',
			},
		},
		{
			name: '动漫',
			ext: {
				id: '/categories/2/movies/',
			},
		}
	],
}

async function home(_inReq, _outResp) {
    try {
        // 构建分类数据
        const classes = appConfig.tabs.map(tab => ({
            type_id: tab.ext.id,
            type_name: tab.name
        }));

        // 访问首页获取数据
        const url = appConfig.site;
        console.log(`Fetching homepage from: ${url}`);
        
        const { data } = await req.get(url, {
            headers: {
                'User-Agent': PC_UA,
            },
        });

        // 使用 jsoup 解析 HTML
        const $ = new jsoup().pq(data);
        
        // 尝试多种可能的选择器来找到电影卡片
        const selectors = ['.cover', '.movie-card', '.video-item', '.movie-item', '.item'];
        let videos = null;
        
        // 遍历尝试不同选择器，直到找到有效的
        for (const selector of selectors) {
            videos = $(selector);
            if (videos && videos.length > 0) {
                console.log(`Found ${videos.length} videos using selector: ${selector}`);
                break;
            }
        }
        
        const cards = [];

        if (videos && videos.length > 0) {
            videos.each((_, e) => {
                const element = $(e);
                
                // 尝试多种方式获取链接、标题和封面图
                let href = element.find('a').attr('href');
                if (!href) href = element.attr('href');
                
                let title = element.find('a img').attr('alt');
                if (!title) title = element.find('.title').text() || element.find('h3').text();
                
                let cover = element.find('a img').attr('src');
                if (!cover) cover = element.find('img').attr('src');
                
                // 只有当有基本信息时才添加卡片
                if (href && (title || cover)) {
                    cards.push({
                        vod_id: href,
                        vod_name: title || '未知标题',
                        vod_pic: cover || '',
                        vod_remarks: element.find('.remarks').text() || '',
                    });
                }
            });
        }
        
        // 如果没有找到任何视频卡片，尝试直接搜索所有图片链接
        if (cards.length === 0) {
            console.log('No cards found with selectors, trying fallback method');
            
            // 尝试找到所有可能是电影封面的图片
            $('a').each((_, a) => {
                const href = $(a).attr('href');
                // 检查链接是否可能是电影详情页
                if (href && (href.includes('/movie/') || href.includes('/detail/') || href.match(/\/\d+\//))) {
                    const img = $(a).find('img');
                    if (img.length > 0) {
                        const title = img.attr('alt') || $(a).text() || '未知标题';
                        const cover = img.attr('src') || '';
                        
                        cards.push({
                            vod_id: href,
                            vod_name: title,
                            vod_pic: cover,
                            vod_remarks: '',
                        });
                    }
                }
            });
        }
        
        console.log(`Total cards found: ${cards.length}`);
        
        // 确保 classes 和 list 都有返回值，即使是空的
        return {
            class: classes,
            list: cards,
        };
    } catch (error) {
        console.error('Error in home function:', error);
        // 确保即使出错也返回有效的结构
        return {
            class: appConfig.tabs.map(tab => ({
                type_id: tab.ext.id,
                type_name: tab.name
            })),
            list: [],
        };
    }
}

async function category(inReq, _outResp) {
    try {
        const pg = inReq.body.page || 1;
        const id = inReq.body.tid;

        const url = appConfig.site + id + `?page=${pg}`;
        console.log(`Fetching category: ${url}`);
        
        const { data } = await req.get(url, {
            headers: {
                'User-Agent': PC_UA,
            },
        });

        const $ = new jsoup().pq(data);
        
        // 尝试多种可能的选择器来找到电影卡片
        const selectors = ['.cover', '.movie-card', '.video-item', '.movie-item', '.item'];
        let videos = null;
        
        for (const selector of selectors) {
            videos = $(selector);
            if (videos && videos.length > 0) {
                break;
            }
        }
        
        const cards = [];

        if (videos && videos.length > 0) {
            videos.each((_, e) => {
                const element = $(e);
                
                let href = element.find('a').attr('href');
                if (!href) href = element.attr('href');
                
                let title = element.find('a img').attr('alt');
                if (!title) title = element.find('.title').text() || element.find('h3').text();
                
                let cover = element.find('a img').attr('src');
                if (!cover) cover = element.find('img').attr('src');
                
                if (href && (title || cover)) {
                    cards.push({
                        vod_id: href,
                        vod_name: title || '未知标题',
                        vod_pic: cover || '',
                        vod_remarks: element.find('.remarks').text() || '',
                    });
                }
            });
        }
        
        // 确定页面总数
        let pagecount = 1;
        const pagination = $('.pagination');
        if (pagination.length > 0) {
            const lastPage = pagination.find('a').last().text();
            if (!isNaN(parseInt(lastPage))) {
                pagecount = parseInt(lastPage);
            }
        }

        return {
            page: pg,
            pagecount: pagecount,
            list: cards,
        };
    } catch (error) {
        console.error('Error in category function:', error);
        return {
            page: 1,
            pagecount: 1,
            list: [],
        };
    }
}

async function detail(inReq, _outResp) {
    try {
        const url = `${appConfig.site}${inReq.body.id}`;
        console.log(`Fetching detail: ${url}`);
        
        const { data } = await req.get(url, {
            headers: {
                'User-Agent': PC_UA,
            },
        });

        const $ = new jsoup().pq(data);
        
        // 创建并初始化vod对象 - 添加基本信息
        const vod = {
            vod_id: inReq.body.id,
            vod_name: $('.movie-info h1').text() || $('h1.title').text() || $('h1').text() || '',
            vod_pic: $('.movie-poster img').attr('src') || $('.poster img').attr('src') || $('img.poster').attr('src') || '',
            vod_content: $('.movie-description').text() || $('.description').text() || $('.content').text() || '',
            vod_year: $('.movie-info .year').text() || $('.year').text() || '',
            vod_area: $('.movie-info .area').text() || $('.area').text() || '',
            vod_director: $('.movie-info .director').text() || $('.director').text() || '',
            vod_actor: $('.movie-info .actor').text() || $('.actor').text() || ''
        };

        // 收集所有网盘分享链接
        const shareUrls = [];
        
        // 尝试多种方式获取分享链接
        const linkSelectors = [
            '.pan-links li a', 
            '.download-links a', 
            '.pan-links a', 
            'a[data-link]', 
            'a[href*="pan"]'
        ];
        
        for (const selector of linkSelectors) {
            $(selector).each((_, link) => {
                const panShareUrl = $(link).attr('data-link') || $(link).attr('href') || $(link).attr('data-url');
                if (panShareUrl && !shareUrls.includes(panShareUrl)) {
                    shareUrls.push(panShareUrl);
                }
            });
            
            // 如果找到了链接，跳出循环
            if (shareUrls.length > 0) {
                break;
            }
        }

        console.log(`Found ${shareUrls.length} share URLs`);

        // 使用 _detail 处理网盘链接
        if (shareUrls.length > 0) {
            const vodFromUrl = await _detail(shareUrls);
            if (vodFromUrl) {
                vod.vod_play_from = vodFromUrl.froms;
                vod.vod_play_url = vodFromUrl.urls;
            }
        }

        return {
            list: [vod],
        };
    } catch (error) {
        console.error('Error in detail function:', error);
        return {
            list: [],
        };
    }
}

async function search(inReq, _outResp) {
    try {
        const pg = inReq.body.page || 1;
        const wd = inReq.body.wd;
        
        let text = encodeURIComponent(wd);
        let url = `${appConfig.site}/s/${text}/?page=${pg}`;
        console.log(`Searching: ${url}`);
        
        const { data } = await req.get(url, {
            headers: {
                'User-Agent': PC_UA,
            },
        });

        const $ = new jsoup().pq(data);
        
        // 尝试多种可能的选择器
        const selectors = ['.cover', '.movie-card', '.search-item', '.video-item', '.movie-item', '.item'];
        let videos = null;
        
        for (const selector of selectors) {
            videos = $(selector);
            if (videos && videos.length > 0) {
                break;
            }
        }
        
        const cards = [];

        if (videos && videos.length > 0) {
            videos.each((_, e) => {
                const element = $(e);
                
                let href = element.find('a').attr('href');
                if (!href) href = element.attr('href');
                
                let title = element.find('a img').attr('alt');
                if (!title) title = element.find('.title').text() || element.find('h3').text();
                
                let cover = element.find('a img').attr('src');
                if (!cover) cover = element.find('img').attr('src');
                
                if (href && (title || cover)) {
                    cards.push({
                        vod_id: href,
                        vod_name: title || '未知标题',
                        vod_pic: cover || '',
                        vod_remarks: element.find('.remarks').text() || '',
                    });
                }
            });
        }

        return {
            page: pg,
            pagecount: 1,
            list: cards,
        };
    } catch (error) {
        console.error('Error in search function:', error);
        return {
            page: 1,
            pagecount: 1,
            list: [],
        };
    }
}

export default {
    meta: {
        key: 'seedhub',
        name: 'SeedHub资源',
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
}

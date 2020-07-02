import * as utils from 'src/utils.js';
import { config } from 'src/config.js';
import { expect } from 'chai';
import { newBidder } from 'src/adapters/bidderFactory.js';
import { spec } from 'modules/amxBidAdapter.js';
import { BANNER, VIDEO } from 'src/mediaTypes';
import { formatQS } from 'src/utils';

const sampleRequestId = '82c91e127a9b93e';
const sampleDisplayAd = (additionalImpressions) => `<script src='https://assets.a-mo.net/tmode.v1.js'></script>${additionalImpressions}`;
const sampleDisplayCRID = '78827819';
// minimal example vast
const sampleVideoAd = (addlImpression) => `
<?xml version="1.0" encoding="UTF-8" ?><VAST version="2.0"><Ad id="128a6.44d74.46b3"><InLine><Error><![CDATA[http://example.net/hbx/verr?e=]]></Error><Impression><![CDATA[http://example.net/hbx/vimp?lid=test&aid=testapp]]></Impression><Creatives><Creative sequence="1"><Linear><Duration>00:00:15</Duration><TrackingEvents><Tracking event="firstQuartile"><![CDATA[https://example.com?event=first_quartile]]></Tracking></TrackingEvents><VideoClicks><ClickThrough><![CDATA[http://example.com]]></ClickThrough></VideoClicks><MediaFiles><MediaFile delivery="progressive" width="16" height="9" type="video/mp4" bitrate="800"><![CDATA[https://example.com/media.mp4]]></MediaFile></MediaFiles></Linear></Creative></Creatives>${addlImpression}</InLine></Ad></VAST>
`.replace(/\n+/g, '')

const embeddedTrackingPixel = `https://1x1.a-mo.net/hbx/g_impression?A=sample&B=20903`;
const sampleNurl = 'https://example.exchange/nurl';

const sampleBidderRequest = {
  gdprConsent: {
    gdprApplies: true,
    consentString: utils.getUniqueIdentifierStr(),
    vendorData: {}
  },
  auctionId: utils.getUniqueIdentifierStr(),
  uspConsent: '1YYY',
  refererInfo: {
    referer: 'https://www.prebid.org',
    canonicalUrl: 'https://www.prebid.org/the/link/to/the/page'
  }
};

const sampleBidRequestBase = {
  bidder: spec.code,
  params: {
    endpoint: 'https://httpbin.org/post',
  },
  sizes: [[320, 50]],
  mediaTypes: {
    [BANNER]: {
      sizes: [[300, 250]]
    }
  },
  adUnitCode: 'div-gpt-ad-example',
  transactionId: utils.getUniqueIdentifierStr(),
  bidId: sampleRequestId,
  auctionId: utils.getUniqueIdentifierStr(),
};

const sampleBidRequestVideo = {
  ...sampleBidRequestBase,
  bidId: sampleRequestId + '_video',
  sizes: [[300, 150]],
  mediaTypes: {
    [VIDEO]: {
      sizes: [[360, 250]]
    }
  }
};

const sampleServerResponse = {
  'p': {
    'hreq': ['https://1x1.a-mo.net/hbx/g_sync?partner=test', 'https://1x1.a-mo.net/hbx/g_syncf?__st=iframe']
  },
  'r': {
    [sampleRequestId]: [
      {
        'b': [
          {
            'adid': '78827819',
            'adm': sampleDisplayAd(''),
            'adomain': [
              'example.com'
            ],
            'crid': sampleDisplayCRID,
            'ext': {
              'himp': [
                embeddedTrackingPixel
              ],
            },
            'nurl': sampleNurl,
            'h': 600,
            'id': '2014691335735134254',
            'impid': '1',
            'price': 0.25,
            'w': 300
          },
          {
            'adid': '222976952',
            'adm': sampleVideoAd(''),
            'adomain': [
              'example.com'
            ],
            'crid': sampleDisplayCRID,
            'ext': {
              'himp': [
                embeddedTrackingPixel
              ],
            },
            'nurl': sampleNurl,
            'h': 1,
            'id': '7735706981389902829',
            'impid': '1',
            'price': 0.25,
            'w': 1
          },
        ],
      }
    ]
  },
}

describe('AmxBidAdapter', () => {
  describe('isBidRequestValid', () => {
    it('endpoint must be an optional string', () => {
      expect(spec.isBidRequestValid({params: { endpoint: 1 }})).to.equal(false)
      expect(spec.isBidRequestValid({params: { endpoint: 'test' }})).to.equal(true)
    });

    it('tagId is an optional string', () => {
      expect(spec.isBidRequestValid({params: { tagId: 1 }})).to.equal(false)
      expect(spec.isBidRequestValid({params: { tagId: 'test' }})).to.equal(true)
    });

    it('testMode is an optional boolean', () => {
      expect(spec.isBidRequestValid({params: { testMode: 1 }})).to.equal(false)
      expect(spec.isBidRequestValid({params: { testMode: false }})).to.equal(true)
    });

    it('none of the params are required', () => {
      expect(spec.isBidRequestValid({})).to.equal(true)
    });
  })
  describe('getUserSync', () => {
    it('will only sync from valid server responses', () => {
      const syncs = spec.getUserSyncs({ iframeEnabled: true });
      expect(syncs).to.eql([]);
    });

    it('will return valid syncs from a server response', () => {
      const syncs = spec.getUserSyncs({ iframeEnabled: true }, [{body: sampleServerResponse}]);
      expect(syncs.length).to.equal(2);
      expect(syncs[0].type).to.equal('image');
      expect(syncs[1].type).to.equal('iframe');
    });

    it('will filter out iframe syncs based on options', () => {
      const syncs = spec.getUserSyncs({ iframeEnabled: false }, [{body: sampleServerResponse}, {body: sampleServerResponse}]);
      expect(syncs.length).to.equal(2);
      expect(syncs).to.satisfy((allSyncs) => allSyncs.every((sync) => sync.type === 'image'))
    });
  });

  describe('buildRequests', () => {
    it('will default to prebid.a-mo.net endpoint', () => {
      const { url } = spec.buildRequests([], sampleBidderRequest);
      expect(url).to.equal('https://prebid.a-mo.net/a/c')
    });

    it('reads test mode from the first bid request', () => {
      const { data } = spec.buildRequests([{
        ...sampleBidRequestBase,
        params: {
          testMode: true
        }
      }], sampleBidderRequest);
      expect(data.tm).to.equal(true);
    });

    it('handles referer data and GDPR, USP Consent', () => {
      const { data } = spec.buildRequests([sampleBidRequestBase], sampleBidderRequest);
      delete data.m; // don't deal with "m" in this test

      expect(data).to.deep.equal({
        a: sampleBidderRequest.auctionId,
        B: 0,
        b: 'www.prebid.org',
        tm: 0,
        V: '$prebid.version$',
        i: btoa('prebid.org').replace(/=+$/, ''),
        l: {},
        f: 0.01,
        cv: 'pba1.0',
        st: 'prebid',
        h: screen.height,
        w: screen.width,
        gs: sampleBidderRequest.gdprConsent.gdprApplies,
        gc: sampleBidderRequest.gdprConsent.consentString,
        u: sampleBidderRequest.refererInfo.canonicalUrl,
        do: 'www.prebid.org',
        re: sampleBidderRequest.refererInfo.referer,
        usp: sampleBidderRequest.uspConsent,
        smt: 9,
        d: '',
      })
    });

    it('can build a banner request', () => {
      const { method, url, data } = spec.buildRequests([sampleBidRequestBase, {
        ...sampleBidRequestBase,
        bidId: sampleRequestId + '_2',
        params: {
          ...sampleBidRequestBase.params,
          tagId: 'example'
        }
      }], sampleBidderRequest)

      expect(url).to.equal(sampleBidRequestBase.params.endpoint)
      expect(method).to.equal('POST');
      expect(Object.keys(data.m).length).to.equal(2);
      expect(data.m[sampleRequestId]).to.deep.equal({
        av: false,
        aw: 300,
        ah: 250,
        tf: 0
      });
      expect(data.m[sampleRequestId + '_2']).to.deep.equal({
        av: false,
        aw: 300,
        i: 'example',
        ah: 250,
        tf: 0
      });
    });

    it('can build a video request', () => {
      const { data } = spec.buildRequests([sampleBidRequestVideo], sampleBidderRequest);
      expect(Object.keys(data.m).length).to.equal(1);
      expect(data.m[sampleRequestId + '_video']).to.deep.equal({
        av: true,
        aw: 360,
        ah: 250,
        tf: 0
      });
    });
  });

  describe('interpretResponse', () => {
    const baseBidResponse = {
      requestId: sampleRequestId,
      cpm: 0.25,
      creativeId: sampleDisplayCRID,
      currency: 'USD',
      netRevenue: true,
      meta: {
        advertiserDomains: ['example.com'],
      },
    };

    const baseRequest = {
      data: {
        m: {
          [sampleRequestId]: {
            aw: 300,
            ah: 250,
          },
        }
      }
    };

    it('will handle a nobid response', () => {
      const parsed = spec.interpretResponse({ body: '' }, baseRequest)
      expect(parsed).to.eql([])
    });

    it('can parse a display ad', () => {
      const parsed = spec.interpretResponse({ body: sampleServerResponse }, baseRequest)
      expect(parsed.length).to.equal(2)

      // we should have display, video, display
      expect(parsed[0]).to.deep.equal({
        ...baseBidResponse,
        meta: {
          ...baseBidResponse.meta,
          mediaType: BANNER,
        },
        width: 300,
        height: 600, // from the bid itself
        ttl: 70,
        ad: sampleDisplayAd(
          `<img src="${embeddedTrackingPixel}" width="0" height="0"/>` +
          `<img src="${sampleNurl}" width="0" height="0"/>`
        ),
      });
    });

    it('can parse a video ad', () => {
      const parsed = spec.interpretResponse({ body: sampleServerResponse }, baseRequest)
      expect(parsed.length).to.equal(2)

      // we should have display, video, display
      expect(parsed[1]).to.deep.equal({
        ...baseBidResponse,
        meta: {
          ...baseBidResponse.meta,
          mediaType: VIDEO,
        },
        width: 300,
        height: 250,
        ttl: 90,
        vastXml: sampleVideoAd(
          `<Impression><![CDATA[${sampleNurl}]]></Impression>` +
          `<Impression><![CDATA[${embeddedTrackingPixel}]]></Impression>`
        ),
      });
    });
  });

  describe('analytics methods', () => {
    let firedPixels = [];
    let _Image = window.Image;
    before(() => {
      _Image = window.Image;
      window.Image = class FakeImage {
        set src(value) {
          firedPixels.push(value)
        }
      }
    });

    beforeEach(() => {
      firedPixels = [];
    });

    after(() => {
      window.Image = _Image;
    });

    it('will fire an event for onSetTargeting', () => {
      spec.onSetTargeting({
        bidder: 'example',
        width: 300,
        height: 250,
        adId: 'ad-id',
        mediaType: BANNER,
        cpm: 1.23,
        requestId: utils.getUniqueIdentifierStr(),
        adUnitCode: 'div-gpt-ad',
        adserverTargeting: {
          hb_pb: '1.23',
          hb_adid: 'ad-id',
          hb_bidder: 'example'
        }
      });
      expect(firedPixels.length).to.equal(1)
      expect(firedPixels[0]).to.match(/\/hbx\/g_pbst/)
      const parsed = new URL(firedPixels[0]);
      const nestedData = parsed.searchParams.get('c2');
      expect(nestedData).to.equal(formatQS({
        hb_pb: '1.23',
        hb_adid: 'ad-id',
        hb_bidder: 'example'
      }));
    });

    it('will log an event for timeout', () => {
      spec.onTimeout({
        bidder: 'example',
        bidId: 'test-bid-id',
        adUnitCode: 'div-gpt-ad',
        timeout: 300,
        auctionId: utils.getUniqueIdentifierStr()
      });
      expect(firedPixels.length).to.equal(1)
      expect(firedPixels[0]).to.match(/\/hbx\/g_pbto/)
    });

    it('will log an event for prebid win', () => {
      spec.onBidWon({
        bidder: 'example',
        adId: 'test-ad-id',
        width: 300,
        height: 250,
        mediaType: VIDEO,
        cpm: 1.34,
        adUnitCode: 'div-gpt-ad',
        timeout: 300,
        auctionId: utils.getUniqueIdentifierStr()
      });
      expect(firedPixels.length).to.equal(1)
      expect(firedPixels[0]).to.match(/\/hbx\/g_pbwin/)

      const pixel = firedPixels[0];
      const url = new URL(pixel);
      expect(url.searchParams.get('C')).to.equal('1')
      expect(url.searchParams.get('np')).to.equal('1.34')
    });
  });
});

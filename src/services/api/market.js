import * as utils from '../../utils/market';
import listener from './chain-listener';
import Subscriptions from './subscriptions';

const findOrder = (orderId) => {
  return (order) => orderId === order.id;
};

const calcOrderRate = (order) => {
  const {
    sell_price: {
      quote: {
        amount: quoteAmount
      },
      base: {
        amount: baseAmount
      }
    }
  } = order;
  return baseAmount / quoteAmount;
};

export default class Market {
  constructor(base) {
    this.base = base;
    this.markets = {};
    const marketsSubscription = new Subscriptions.Markets({
      callback: this.onMarketUpdate.bind(this)
    });
    listener.addSubscription(marketsSubscription);
    listener.enable();
  }

  getCallback(pays, receives) {
    if (pays === this.base) {
      if (this.isSubscribed(receives)) {
        return this.markets[receives].callback;
      }
    }
    if (receives === this.base) {
      if (this.isSubscribed(pays)) {
        return this.markets[pays].callback;
      }
    }
    return false;
  }

  getOrdersArray(pays, receives) {
    if (pays === this.base) {
      if (this.isSubscribed(receives)) {
        return this.markets[receives].orders.buy;
      }
    }
    if (receives === this.base) {
      if (this.isSubscribed(pays)) {
        return this.markets[pays].orders.sell;
      }
    }
    return false;
  }

  onMarketUpdate(type, object) {
    switch (type) {
      case 'newOrder': {
        this.onNewLimitOrder(object);
        break;
      }
      case 'deleteOrder': {
        this.onOrderDelete(object);
        break;
      }
      case 'fillOrder': {
        this.onOrderFill(object);
        break;
      }
      default: break;
    }
  }

  onOrderDelete(notification) {
    Object.keys(this.markets).forEach((market) => {
      Object.keys(this.markets[market].orders).forEach((type) => {
        const idx = this.markets[market].orders[type].findIndex(findOrder(notification));
        if (idx >= 0) {
          this.markets[market].orders[type].splice(idx, 1);
          this.markets[market].callback('DELETE ORDER');
        }
      });
    });
  }

  onNewLimitOrder(order) {
    const {
      base: {
        asset_id: pays
      },
      quote: {
        asset_id: receives
      }
    } = order.sell_price;

    const orders = this.getOrdersArray(pays, receives);

    if (orders) {
      orders.push(order);
      const callback = this.getCallback(pays, receives);
      callback('ADD ORDER');
    }
  }

  onOrderFill(data) {
    const {
      order_id: orderId,
      pays: { amount, asset_id: pays },
      receives: { asset_id: receives }
    } = data.op[1];

    const orders = this.getOrdersArray(pays, receives);

    if (orders) {
      const idx = orders.findIndex(findOrder(orderId));
      if (idx !== -1) {
        orders[idx].for_sale -= amount;
        const callback = this.getCallback(pays, receives);
        callback('FILL ORDER');
      }
    }
  }

  isSubscribed(assetId) {
    return (this.markets[assetId] !== undefined);
  }

  setDefaultObjects(assetId) {
    if (this.markets[assetId] === undefined) {
      this.markets[assetId] = {
        orders: {
          buy: [], sell: []
        },
        callback: () => {}
      };
    }
  }

  async subscribeToMarket(assetId, callback) {
    if (assetId === this.base) return;
    const { buyOrders, sellOrders } = await utils.loadLimitOrders(this.base, assetId);
    this.setDefaultObjects(assetId);
    this.markets[assetId].orders.buy = buyOrders;
    this.markets[assetId].orders.sell = sellOrders;
    this.markets[assetId].callback = callback;
    callback();
  }

  unsubscribeFromMarket(assetId) {
    if (this.isSubscribed(assetId)) {
      delete this.markets[assetId];
    }
  }

  unsubscribeFromExchangeRate(assetId) {
    this.unsubscribeFromMarket(assetId);
  }

  async subscribeToExchangeRate(assetId, amount, callback) {
    let canReceiveInBasePrev = 0;
    const wrappedCallback = () => {
      const canReceiveInBase = this.calcExchangeRate(assetId, 'sell', amount);
      if (canReceiveInBase !== canReceiveInBasePrev && canReceiveInBase > 0) {
        canReceiveInBasePrev = canReceiveInBase;
        callback(assetId, canReceiveInBase);
      }
    };
    await this.subscribeToMarket(assetId, wrappedCallback);
  }

  calcExchangeRate(assetId, type, amount) {
    let totalPay = amount;
    let totalReceive = 0;
    let orders = [];

    if (type === 'sell') {
      orders = this.markets[assetId].orders.buy.sort((a, b) =>
        calcOrderRate(b) - calcOrderRate(a));
    } else {
      orders = this.markets[assetId].orders.sell.sort((a, b) =>
        calcOrderRate(b) - calcOrderRate(a));
    }

    for (let i = 0; i < orders.length; i += 1) {
      const { for_sale: saleAmount, sell_price: price } = orders[i];
      const weCanPay = Math.round(saleAmount * (price.base.amount / price.quote.amount));
      if (totalPay > weCanPay) {
        totalReceive += Math.round(weCanPay * (price.base.amount / price.quote.amount));
        totalPay -= weCanPay;
      } else {
        totalReceive += Math.round(totalPay * (price.base.amount / price.quote.amount));
        break;
      }
    }
    return totalReceive;
  }
}

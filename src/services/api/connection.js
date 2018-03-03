import { Apis } from 'bitsharesjs-ws';
import config from '../../../config';
import NodesManager from './nodes-manager';

const nodesManager = new NodesManager({
  nodes: config.bitsharesNodes.list,
  defaultNode: config.bitsharesNodes.defaultNode
});

/**
 * Connects to bitsharesjs-ws with provided callback function
 */
const connect = (statusCallback, changeNode) => {
  const url = changeNode ? nodesManager.getAnotherNodeUrl() : nodesManager.getInitialNodeUrl();
  console.log('Connecting to node : ', url);

  Apis.setRpcConnectionStatusCallback(statusCallback);
  Apis.instance(url, true).init_promise.then(() => {
    statusCallback('realopen');
    nodesManager.testNodesPings();
  }).catch(error => {
    statusCallback('error');
  });
};

//
const disconnect = () => {
  Apis.setRpcConnectionStatusCallback(null);
  return Apis.close();
};

export default {
  connect, disconnect
};

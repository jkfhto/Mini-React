import $ from 'jquery';
import {createUnit} from './unit';
import {createElement} from './element';
import {Component} from './component';
let React = {
    render,
    createElement,
    Component
}

//此元素可能是一个文本节点、DOM节点(div)、或者 自定义组件Counter
function render(element,container){
  //container.innerHTML=`<span data-reactid="${React.rootIndex}">${element}</span>`;
  //unit单元就是用来负责渲染的，负责把元素转换成可以在页面上显示的HTML字符串
  let unit = createUnit(element);
  //用于对组件的渲染,返回组件的HTML字符串 getMarkUp：参数0 节点的id值
  let markUp = unit.getMarkUp('0');
  //把组装好的DOM放入container容器中 首次渲染时使用批处理 一次性插入页面 优化渲染性能
  $(container).html(markUp);
  //触发装载完成事件
  $(document).trigger('mounted');
}
export default React


/* <h1>hello</h1>
React.createElement('h1',{},'hello'); */
import { Element } from './element';
import $ from 'jquery';
import types from './types';
let diffQueue = [];//差异队列 比较两棵虚拟DOM树的差异 处理差异队列更新渲染
let updateDepth = 0;//更新的级别
class Unit {
    constructor(element) {
        //凡是挂载到私有属性上的都以_开头
        this._currentElement = element;
    }
    //用于对组件的渲染，返回组件对应的HTML字符串 子类需要实现具体的逻辑
    getMarkUp() {
        throw Error('此方法不能被调用');
    }
}

//处理字符串 数值对应的节点
class TextUnit extends Unit {
    //返回组件对应的HTML字符串
    getMarkUp(reactid) {
        this._reactid = reactid;//保存记录节点id值
        //this._currentElement：字符串或数值内容
        //返回文本节点对应的HTML字符串
        return `<span data-reactid="${reactid}">${this._currentElement}</span>`;
    }
    
    //处理组件更新
    update(nextElement) {
        //判断字符串或数值是否修改 修改则更新
        if (this._currentElement !== nextElement) {
            this._currentElement = nextElement;
            $(`[data-reactid="${this._reactid}"]`).html(this._currentElement);
        }
    }
}
/**
{type:'button',props:{id:'sayHello'},children:['say',{type:'b',{},'Hello'}]}
<button id="sayHello" style="color:red;background-color:'green" onclick="sayHello()">
   <span>say</span>
   <b>Hello</b>
</button>
*/
//处理原生dom节点
class NativeUnit extends Unit {
    //返回组件对应的HTML字符串
    getMarkUp(reactid) {
        this._reactid = reactid;
        let { type, props } = this._currentElement;//虚拟dom js对象
        let tagStart = `<${type} data-reactid="${this._reactid}"`;
        let childString = '';
        let tagEnd = `</${type}>`;
        this._renderedChildrenUnits = [];//存放子元素的 unit实例 用于dom-diff
        //{id:'sayHello',onClick:sayHello,style:{color:'red',backgroundColor:'green'}},children:['say',{type:'b',{},'Hello'}]
        for (let propName in props) {
            if (/^on[A-Z]/.test(propName)) {//绑定事件
                let eventName = propName.slice(2).toLowerCase();//click
                // 没有生成实际的节点不能直接绑定事件 需要使用事件委托绑定事件
                $(document).delegate(`[data-reactid="${this._reactid}"]`, `${eventName}.${this._reactid}`, props[propName]);
            } else if (propName === 'style') {//处理样式
                let styleObj = props[propName];
                let styles = Object.entries(styleObj).map(([attr, value]) => {
                    return `${attr.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}:${value}`;//遍历style对象 将key值中大小字母替换成小写字母加 -前缀 
                }).join(';');//合并成字符串
                tagStart += (` style="${styles}" `);
            } else if (propName === 'className') {//处理className类名
                tagStart += (` class="${props[propName]}" `);
            } else if (propName == 'children') {
                let children = props[propName];
                //遍历子节点 递归生成子节点
                children.forEach((child, index) => {
                    let childUnit = createUnit(child);//根据 element 的类型，可能是一个字符中，原生dom节点，也可以也是一个react元素 虚拟DOM ,返回一个 Component 的实例,是一个工厂函数
                    childUnit._mountIndex = index;//每个unit有一个_mountIndex 属性，指向自己在父节点中的索引位置
                    this._renderedChildrenUnits.push(childUnit);
                    //用于对组件的渲染,返回组件的HTML字符串 getMarkUp：参数传递节点的id值  这块使用父节点id加子节点的索引构成
                    let childMarkUp = childUnit.getMarkUp(`${this._reactid}.${index}`);
                    childString += childMarkUp;
                });
            } else {
                //处理基本的属性
                tagStart += (` ${propName}=${props[propName]} `);
            }
        }
        //批处理返回完整的html字符串 一次性插入页面 优化渲染性能
        return tagStart + ">" + childString + tagEnd;
    }

    //处理组件更新 nextElement：组件render返回的新的Element实例（虚拟dom js对象）
    update(nextElement) {
        let oldProps = this._currentElement.props;
        let newProps = nextElement.props;
        this.updateDOMProperties(oldProps, newProps);
        this.updateDOMChildren(nextElement.props.children);
    }
    //此处要把新的儿子们传过来，然后后我老的儿子们进行对比，然后找出差异，进行修改DOM
    updateDOMChildren(newChildrenElements) {
        updateDepth++;
        this.diff(diffQueue, newChildrenElements);
        updateDepth--;
        //深度优先遍历 遍历完打补丁
        if (updateDepth === 0) {
            console.log(diffQueue)
            //打补丁
            this.patch(diffQueue);
            diffQueue = [];
        }
    }

    //打补丁
    patch(diffQueue) {
        let deleteChildren = [];//这里要放着所有将要删除的节点
        let deleteMap = {};//这里暂存能复用的节点
        for (let i = 0; i < diffQueue.length; i++) {
            let difference = diffQueue[i];
            if (difference.type === types.MOVE || difference.type === types.REMOVE) {
                let fromIndex = difference.fromIndex;
                let oldChild = $(difference.parentNode.children().get(fromIndex));
                if (!deleteMap[difference.parentId]) {
                    deleteMap[difference.parentId] = {}
                }
                deleteMap[difference.parentId][fromIndex] = oldChild;
                deleteChildren.push(oldChild);//暂存需要删除的dom节点
            }
        }
        //删除dom节点
        $.each(deleteChildren, (idx, item) => $(item).remove());

        //插入新的dom节点
        for (let i = 0; i < diffQueue.length; i++) {
            let difference = diffQueue[i];
            switch (difference.type) {
                case types.INSERT:
                    this.insertChildAt(difference.parentNode, difference.toIndex, $(difference.markUp));
                    break;
                case types.MOVE:
                    this.insertChildAt(difference.parentNode, difference.toIndex, deleteMap[difference.parentId][difference.fromIndex]);
                    break;
                default:
                    break;
            }
        }
    }

    //在指定父节点孩子节点指定索引位置插入节点
    insertChildAt(parentNode, index, newNode) {
        let oldChild = parentNode.children().get(index);
        //指定位置存在节点 则插入到存在节点前面 否则直接插入节点
        oldChild ? newNode.insertBefore(oldChild) : newNode.appendTo(parentNode);
    }

    //获取补丁数组diffQueue
    diff(diffQueue, newChildrenElements) {
        //第一通过组件就状态 对应的孩子节点（unit数组） 映射生成一个map 用于快速查找旧的unit是否存在 进而判断是否可以复用旧的unit
        let oldChildrenUnitMap = this.getOldChildrenMap(this._renderedChildrenUnits);
        //第二步生成一个新的儿子unit的数组
        let { newChildrenUnitMap, newChildrenUnits } = this.getNewChildren(oldChildrenUnitMap, newChildrenElements);
        let lastIndex = 0;//上一个已经确定位置的索引
        for (let i = 0; i < newChildrenUnits.length; i++) {
            let newUnit = newChildrenUnits[i];
            //第一个拿 到的就是newKey=A
            let newKey = (newUnit._currentElement.props && newUnit._currentElement.props.key) || i.toString();//获取key值 默认值为索引
            let oldChildUnit = oldChildrenUnitMap[newKey];
            if (oldChildUnit === newUnit) {//如果说新老一致的话说明复用了老节点
                //处理unit移动 当 unit在旧数组中的索引小于在新的数组中的索引
                if (oldChildUnit._mountIndex < lastIndex) {
                    diffQueue.push({
                        parentId: this._reactid,//父节点id
                        parentNode: $(`[data-reactid="${this._reactid}"]`),//父节点对应的jquery对象
                        type: types.MOVE,//操作类型
                        fromIndex: oldChildUnit._mountIndex,//移动的初始位置索引
                        toIndex: i//移动的终点位置索引
                    });
                }
                lastIndex = Math.max(lastIndex, oldChildUnit._mountIndex);
            } else {
                //删除旧节点中没有再使用的unit 针对key值没变但是节点type发生变化
                if (oldChildUnit) {
                    diffQueue.push({
                        parentId: this._reactid,//父节点id
                        parentNode: $(`[data-reactid="${this._reactid}"]`),//父节点对应的jquery对象
                        type: types.REMOVE,//操作类型
                        fromIndex: oldChildUnit._mountIndex
                    });
                    this._renderedChildrenUnits = this._renderedChildrenUnits.filter(item => item != oldChildUnit);
                    $(document).undelegate(`.${oldChildUnit._reactid}`);
                }
                //插入新节点
                diffQueue.push({
                    parentId: this._reactid,//父节点id
                    parentNode: $(`[data-reactid="${this._reactid}"]`),//父节点对应的jquery对象
                    type: types.INSERT,//操作类型
                    toIndex: i,
                    markUp: newUnit.getMarkUp(`${this._reactid}.${i}`)//unit对应的html字符创
                });
            }
            newUnit._mountIndex = i;
        }
        //删除旧节点中没有再使用的unit 针对key值 删除旧节点 存在问题：key值没变但是节点type发生变化
        for (let oldKey in oldChildrenUnitMap) {
            let oldChild = oldChildrenUnitMap[oldKey];
            if (!newChildrenUnitMap.hasOwnProperty(oldKey)) {
                diffQueue.push({
                    parentId: this._reactid,
                    parentNode: $(`[data-reactid="${this._reactid}"]`),
                    type: types.REMOVE,
                    fromIndex: oldChild._mountIndex
                });
                //如果要删除掉某一个节点，则要把它对应的unit也删除掉
                this._renderedChildrenUnits = this._renderedChildrenUnits.filter(item => item != oldChild);
                //还要把这个节点地应的事件委托也删除掉
                $(document).undelegate(`.${oldChild._reactid}`);
            }
        }

    }
    getNewChildren(oldChildrenUnitMap, newChildrenElements) {
        let newChildrenUnits = [];
        let newChildrenUnitMap = {};
        newChildrenElements.forEach((newElement, index) => {
            //一定要给定key，千万不要让它走内的索引key 使用索引可能导致旧的unit无法复用
            let newKey = (newElement.props && newElement.props.key) || index.toString();
            let oldUnit = oldChildrenUnitMap[newKey];//找到老的unit
            let oldElement = oldUnit && oldUnit._currentElement;//获取老的Element元素
            if (shouldDeepCompare(oldElement, newElement)) {
                //如果可以进行深比较，则把更新的工作交给上次渲染出来的那个element元素对应的unit来处理
                oldUnit.update(newElement);
                newChildrenUnits.push(oldUnit);//直接复用老的unit 构建新的unit数组
                newChildrenUnitMap[newKey] = oldUnit;
            } else {
                //无法复用创建新的unit
                let nextUnit = createUnit(newElement);
                newChildrenUnits.push(nextUnit);//创建新的unit 构建新的unit数组
                newChildrenUnitMap[newKey] = nextUnit;
                this._renderedChildrenUnits[index] = nextUnit;
            }
        });
        return { newChildrenUnitMap, newChildrenUnits };
    }
    getOldChildrenMap(childrenUnits = []) {
        let map = {};
        for (let i = 0; i < childrenUnits.length; i++) {
            let unit = childrenUnits[i];
            let key = (unit._currentElement.props && unit._currentElement.props.key) || i.toString();//设置key值 如果props存在key值则取key值 默认是索引 
            map[key] = unit;//设置value
        }
        return map;
    }

    //更新Props
    updateDOMProperties(oldProps, newProps) {
        let propName;
        for (propName in oldProps) {//循环老的属性集合
            //删除老的没有使用的属性
            if (!newProps.hasOwnProperty(propName)) {
                $(`[data-reactid="${this._reactid}"]`).removeAttr(propName);
            }
            //移除所有事件的事件委托
            if (/^on[A-Z]/.test(propName)) {
                $(document).undelegate(`.${this._reactid}`);
            }
        }
        //处理新的props 覆盖旧的prop或者添加新的prop
        for (propName in newProps) {
            if (propName == 'children') {//如果儿子属性的话，我们先不处理
                continue;
            } else if (/^on[A-Z]/.test(propName)) {
                //重新为所有事件绑定事件委托
                let eventName = propName.slice(2).toLowerCase();//click
                $(document).delegate(`[data-reactid="${this._reactid}"]`, `${eventName}.${this._reactid}`, newProps[propName]);
            } else if (propName === 'className') {//如果是一个类名的话
                //$(`[data-reactid="${this._reactid}"]`)[0].className = newProps[propName];
                $(`[data-reactid="${this._reactid}"]`).attr('class', newProps[propName]);
            } else if (propName == 'style') {
                let styleObj = newProps[propName];
                Object.entries(styleObj).map(([attr, value]) => {
                    //直接修改样式
                    $(`[data-reactid="${this._reactid}"]`).css(attr, value);
                })
            } else {
                $(`[data-reactid="${this._reactid}"]`).prop(propName, newProps[propName]);
            }
        }
    }
}
// dom.dataset.reactid  $(dom).data('reactid');
class CompositeUnit extends Unit {
    //返回组件对应的HTML字符串
    getMarkUp(reactid) {
        this._reactid = reactid;
        let { type: Component, props } = this._currentElement;//获取自定义组件类的定义 以及属性
        let componentInstance = this._componentInstance = new Component(props);//实例化自定义组件
        //让组件的实例的currentUnit属性等于当前的unit
        componentInstance._currentUnit = this;
        //如果有componentWillMount钩子函数就让它执行
        componentInstance.componentWillMount && componentInstance.componentWillMount();
        //调用render方法获得虚拟DOM元素
        let renderedElement = componentInstance.render();
        //根据虚拟DOM元素实例化,可能是CompositeUnit、NativeUnit或TextUnit
        let renderedUnitInstance = this._renderedUnitInstance = createUnit(renderedElement);
        //通过unit可以获得它的html 标记markup
        let renderedMarkUp = renderedUnitInstance.getMarkUp(this._reactid);
        //在这个时候绑定一个componentDidMount事件
        $(document).on('mounted', () => {
            componentInstance.componentDidMount && componentInstance.componentDidMount();
        });
        //返回组件对应的字符串
        return renderedMarkUp;
    } 

    //这里负责处理组件的更新操作
    update(nextElement, partialState) {
        //先获取到新的元素
        this._currentElement = nextElement || this._currentElement;
        //获取组件新的状态，不管要不要更新组件，组件的状态一定要修改
        let nextState = Object.assign(this._componentInstance.state, partialState);
        //获取组件新的属性
        let nextProps = this._currentElement.props;
        //根据组件新的状态和属性 与老的属性和状态比较 是否需要更新
        if (this._componentInstance.shouldComponentUpdate && !this._componentInstance.shouldComponentUpdate(nextProps, nextState)) {
            return;
        }
        // 下面要进行比较更新 先得到上次渲染的单元
        let preRenderedUnitInstance = this._renderedUnitInstance;
        //得到上次渲染的元素
        let preRenderedElement = preRenderedUnitInstance._currentElement;
        let nextRenderElement = this._componentInstance.render();
        //如果新旧两个元素类型一样，则可以进行深度比较，进行复用
        if (shouldDeepCompare(preRenderedElement, nextRenderElement)) {
            //如果可以进行深比较，则把更新的工作交给上次渲染出来的那个element元素对应的unit来处理
            preRenderedUnitInstance.update(nextRenderElement);
            //如果有componentDidUpdate钩子函数就让它执行
            this._componentInstance.componentDidUpdate && this._componentInstance.componentDidUpdate();
        } else {
            this._renderedUnitInstance = createUnit(nextRenderElement);
            let nextMarkUp = this._renderedUnitInstance.getMarkUp(this._reactid);
            //将旧节点替换成新的节点
            $(`[data-reactid="${this._reactid}"]`).replaceWith(nextMarkUp);
        }
    }
}
//判断两个元素的类型一样不一样
function shouldDeepCompare(oldElement, newElement) {
    if (oldElement != null && newElement != null) {
        let oldType = typeof oldElement;
        let newType = typeof newElement;
        //处理数字 字符串
        if ((oldType === 'string' || oldType == 'number') && (newType === 'string' || newType == 'number')) {
            return true;
        }
        //处理虚拟dom js对象
        if (oldElement instanceof Element && newElement instanceof Element) {
            //如果类型一样需要进行深度比较
            return oldElement.type == newElement.type;
        }
    }
    return false;
}
function createUnit(element) {
    //处理数字 字符串
    if (typeof element === 'string' || typeof element === 'number') {
        //返回一个文本元素实例
        return new TextUnit(element);
    }
    //处理元素dom节点
    if (element instanceof Element && typeof element.type === 'string') {
        return new NativeUnit(element);
    }
    //处理react组件
    if (element instanceof Element && typeof element.type === 'function') {
        return new CompositeUnit(element);
    }
}
export {
    createUnit
}

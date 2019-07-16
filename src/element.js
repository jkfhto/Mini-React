class Element{
    constructor(type,props){
        this.type  = type;
        this.props = props;
    }
}
function createElement(type,props={},...children){
   props.children = children||[];//children也是props的一个属性
   return new Element(type,props); 
}

export {
    Element,
    createElement
}